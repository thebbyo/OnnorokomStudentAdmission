# School Admission System: Design

Date: 2026-11-10 · Deadline: 2026-11-11 23:59:59 · Status: approved in chat, awaiting written review

## 1. Goal

First-come-first-served online admission for a private school. Each class-shift is a "class" with a fixed seat count. Applying puts a seat on HOLD for `HOLD_DURATION_SECONDS`. Paying within that time CONFIRMS the seat. Otherwise the seat returns to the pool automatically. A school admin and parents use a React UI. Evaluators run `docker compose up` (Docker only) and automated tests against the API.

**Success means:** the 12 mandatory rules hold under concurrent load, the API contract matches byte-for-byte on field names, `docker compose up` works from a clean clone, and the UI makes every action and error obvious on a 360px phone.

**Priority when time runs short:** backend rules and tests, then the UI rules (8–12), then the UI requirements list, then polish. Never trade a rule for polish.

## 2. Assumptions (also go to ASSUMPTIONS.md)

| Topic | Decision | Why |
|---|---|---|
| Class name uniqueness | Not unique | Evaluator test suites will likely create the same name repeatedly. 409 would break them. |
| Name | Trimmed, 1–200 chars | A blank name is meaningless. The cap prevents abuse. |
| totalSeats | Integer 1–100,000 | Must be > 0 (also a DB CHECK). The upper bound keeps the input sane. |
| Student ID | Exactly 17 ASCII digits, leading zeros allowed | A birth registration number is 17 digits. |
| IDs | `c_` / `h_` + 32 hex chars (GUID "N") | The brief leaves the format to us. A prefix makes the type obvious. Anything unparseable → 400. |
| `GET /me/holds` | Returns an **array**, newest first | The PDF shows one object, but the endpoint is "all of this student's applications". |
| `GET /holds/{id}` | No header needed | The PDF lists no header for it. |
| Re-apply | Allowed after CANCELLED or EXPIRED | Only HELD and CONFIRMED count as active. |
| Confirm, CONFIRMED already, same student | 200 CONFIRMED | Idempotent (rule 5). |
| Cancel | Only HELD. CONFIRMED / EXPIRED / CANCELLED → 409 | A paid admission isn't cancellable via this API. |
| Another student's hold | 403 on confirm/cancel | Rule 4. |
| Admin | No auth | The brief says no login. |
| Class edit/delete | Not provided | Not in the API. |

## 3. Architecture

A single ASP.NET Core 8 minimal-API project with a thin service layer. All transactional rules live in `AdmissionService`. The alternatives considered were Clean Architecture (too much ceremony for the time) and Postgres stored functions (hides logic from tests and review).

```
backend/
  Admission.sln
  src/Admission.Api/
    Program.cs                 DI, JSON, CORS, pool, error middleware, migrate-with-retry
    Endpoints/ClassEndpoints.cs, HoldEndpoints.cs, MeEndpoints.cs
    Domain/SchoolClass.cs, Hold.cs, HoldStatus.cs, PublicId.cs
    Data/AdmissionDbContext.cs, Migrations/
    Services/AdmissionService.cs, ExpirySweeper.cs, AdmissionOptions.cs
    Errors/ApiException.cs, ErrorCodes.cs, ErrorHandlingMiddleware.cs, Validation.cs
  tests/Admission.Tests/       xUnit + WebApplicationFactory + Testcontainers.PostgreSql
  Dockerfile, Dockerfile.test
frontend/
  src/api/ hooks/ pages/ components/ styles/
  Dockerfile, docker-entrypoint.sh (writes config.js), nginx.conf
docker-compose.yml
README.md  ASSUMPTIONS.md  AI_USAGE.md
```

## 4. Data model

**classes**: `id uuid PK`, `name varchar(200) NOT NULL`, `total_seats int NOT NULL CHECK (total_seats > 0)`, `created_at timestamptz NOT NULL DEFAULT now()`.

**holds**: `id uuid PK`, `class_id uuid NOT NULL FK → classes`, `student_id char(17) NOT NULL`, `status text NOT NULL CHECK (status IN ('HELD','CONFIRMED','EXPIRED','CANCELLED'))`, `created_at timestamptz NOT NULL DEFAULT now()`, `expires_at timestamptz NOT NULL`, `confirmed_at timestamptz NULL`, `cancelled_at timestamptz NULL`.

**Indexes on holds:**
- Unique `(class_id, student_id) WHERE status IN ('HELD','CONFIRMED')`
- `(class_id, status)`
- `(student_id)`
- `(expires_at) WHERE status = 'HELD'`

Status is stored as text via an EF value conversion. Timestamps are `timestamptz`, mapped to UTC `DateTime`.

## 5. Concurrency and expiry

All time decisions use Postgres `now()` (transaction start time), never the app clock.

**Hold**, POST /classes/{id}/holds. One transaction at READ COMMITTED:
1. `SELECT id, total_seats FROM classes WHERE id = @id FOR UPDATE`. No row → 404 `CLASS_NOT_FOUND`.
2. `UPDATE holds SET status='EXPIRED' WHERE class_id=@id AND status='HELD' AND expires_at <= now()`
3. Student already has HELD/CONFIRMED in this class → 409 `ALREADY_APPLIED`.
4. `count(*) WHERE status IN ('HELD','CONFIRMED') >= total_seats` → 409 `SEATS_FULL`.
5. `INSERT … expires_at = now() + make_interval(secs => @duration) RETURNING expires_at`. Commit → 201.

A unique violation (23505) is mapped to 409 `ALREADY_APPLIED` as a second line of defense.

**Confirm**, POST /holds/{id}/confirm. Load the hold's class_id (404 if missing). Lock the class row, then the hold row (`FOR UPDATE`), always in that order, so confirm/cancel/hold never deadlock. Then:
- Wrong student → 403.
- CONFIRMED → 200 (idempotent, no count change).
- CANCELLED → 409 `HOLD_CANCELLED`.
- EXPIRED, or HELD with `expires_at <= now()` → persist EXPIRED, 409 `HOLD_EXPIRED`.
- Otherwise set CONFIRMED and `confirmed_at = now()` → 200.

**Cancel**, DELETE /holds/{id}. Same locking. Wrong student → 403. Expired-HELD → persist EXPIRED, 409 `HOLD_EXPIRED`. Non-HELD → 409 `HOLD_NOT_ACTIVE`. Otherwise CANCELLED → 204.

**Sweeper**: a `BackgroundService` that runs `UPDATE holds SET status='EXPIRED' WHERE status='HELD' AND expires_at <= now()` every 2s. It catches and logs errors and never crashes the host. It doesn't need the class lock because it only moves HELD to EXPIRED, which never increases occupancy. Confirm and cancel lock the hold row, so a race with the sweeper is decided once.

**Reads**: effective status = `HELD && expires_at <= now()` → EXPIRED. Class counts are computed in one query: held = HELD and `expires_at > now()`, confirmed = CONFIRMED, available = total − held − confirmed (≥ 0).

**Multi-process**: all locks are row locks in Postgres, so rule 1 holds across `backend` and `backend2`.

**Pool**: Npgsql `Maximum Pool Size=50`, `Timeout=30`. Postgres `max_connections=200`. Excess requests queue for a connection instead of failing. Hold transactions are a few milliseconds each, so the queue drains quickly.

## 6. API and errors

Contract exactly as the brief, all JSON, camelCase, `expiresAt` formatted as `yyyy-MM-ddTHH:mm:ssZ` in UTC. Extra fields are allowed (e.g. `className` on hold responses, `studentId` on GET hold).

Error body: `{ "error": "<CODE>", "message": "<human text>" }`.

| Status | Codes |
|---|---|
| 400 | `VALIDATION_ERROR` (body/JSON/name/totalSeats), `INVALID_STUDENT_ID`, `INVALID_ID` |
| 403 | `FORBIDDEN` |
| 404 | `CLASS_NOT_FOUND`, `HOLD_NOT_FOUND`, `NOT_FOUND` (unknown route) |
| 409 | `SEATS_FULL`, `ALREADY_APPLIED`, `HOLD_EXPIRED`, `HOLD_CANCELLED`, `HOLD_NOT_ACTIVE` |
| 500 | `INTERNAL` (only for genuine bugs; never for input) |

The body is parsed manually from `JsonElement`/`JsonDocument`, so malformed JSON, wrong types (`"totalSeats": "abc"`, `1.5`, `true`), missing fields, and an empty body all map to 400 rather than relying on framework binding. Validation order: id format → header → body. CORS allows `CORS_ORIGINS` (comma-separated, default `http://localhost:3000`) and exposes the `Date` header.

Env vars: `ConnectionStrings__Default`, `HOLD_DURATION_SECONDS` (default 600; invalid or ≤ 0 → 600), `SWEEP_INTERVAL_SECONDS` (default 2), `CORS_ORIGINS`, `ASPNETCORE_URLS=http://+:8080`.

Startup: apply migrations in a retry loop (up to 30 attempts, 2s apart) before accepting traffic.

## 7. Frontend

React 18 + TypeScript + Vite, react-router-dom, no UI library, plain CSS with tokens.

**Routes:**
- `/`: the class list.
- `/admin`: create a class.
- `/holds/:holdId`: one hold.
- `/me`: my applications.

**Modules:**
- `api/client.ts`: a fetch wrapper. It reads `window.__CONFIG__.API_BASE_URL`, tracks `serverOffsetMs` from the `Date` header, and throws a typed `ApiError` (code, status, message). It treats network failure as `NETWORK`.
- `api/messages.ts`: maps every error code to plain language (what happened + what to do).
- `hooks/useStudentId`: stores the ID in localStorage, with validation and a digit count.
- `hooks/usePolling`: a fixed interval that pauses while the tab is hidden and refetches immediately on visibility/focus.
- `hooks/useCountdown`: computes remaining time from `expiresAt` and the server offset.
- `state/connection`: a global online/offline flag that drives the "Can't reach the server, retrying…" banner.

**Pages:**
- **StudentBar** (sticky): numeric input, "12/17" counter, Save/Change.
- **ClassList**: polls `/classes` every 3s and `/me/holds` every 5s when an ID is set. Shows a stacked seat bar, tabular-nums, a Full state, the student's own status per class, and "Updated Xs ago" / "Reconnecting…".
- **Admin**: an inline-validated form that adds the new class to the list on success.
- **Hold page**: a large mm:ss countdown with an urgent state under 60s (icon + text + color), Pay as the primary button, and Cancel with a confirm step. Shows EXPIRED with "Apply again" when seats are free, and a success state when CONFIRMED. Re-fetches every 3s.
- **My applications**: grouped active-first, status badges, live countdowns, a link to each hold.

**Shared states:**
- Skeleton loaders.
- Empty states that say what to do next.
- Buttons disabled and relabelled while in flight ("Paying…").
- An error boundary, so the page is never blank.

**a11y:** labelled inputs, visible focus, `aria-live="polite"` that announces only status changes and seat-state transitions (e.g. becoming Full), AA contrast, and 360px with no horizontal scroll.

**Style:** locked with tastemaker before the CSS is written. An official-but-friendly school portal look with one AA-passing palette, a system font stack, an 8px spacing scale, and a small radius scale. Motion is limited to seat-bar width transitions, the urgency pulse, and status changes, with `prefers-reduced-motion` respected.

Runtime config: nginx serves `dist`, and the entrypoint writes `config.js` from `API_BASE_URL` (default `http://localhost:8080`). The page loads it before the app bundle.

## 8. Docker

`docker-compose.yml`:

| Service | Details |
|---|---|
| `db` | postgres:16-alpine, named volume `pgdata`, `command: postgres -c max_connections=200`, healthcheck `pg_isready` |
| `backend` | built from backend/Dockerfile (sdk:8.0 → aspnet:8.0), port 8080, `depends_on: db: service_healthy`, `restart: unless-stopped` |
| `frontend` | built from frontend/Dockerfile (node:20-alpine build → nginx:alpine), port 3000:80, env `API_BASE_URL` |
| `backend2` (profile `bonus`) | same image, port 8081:8080, CORS also allows 3000 |
| `backend-tests` (profile `tests`) | sdk:8.0, mounts `/var/run/docker.sock`, `TESTCONTAINERS_HOST_OVERRIDE=host.docker.internal` plus `extra_hosts: host.docker.internal:host-gateway` (needed on Linux), runs `dotnet test` |
| `frontend-tests` (profile `tests`) | node:20, runs `npm ci && npm test -- --run` |

Each folder has a `.dockerignore` (`bin`, `obj`, `node_modules`, `dist`, `._*`).

## 9. Testing

**Backend** (written test-first, real Postgres via Testcontainers, one container per test class, fresh data per test):
1. **Concurrency**: a 5-seat class and 50 distinct students fire simultaneously. Exactly 5 × 201, 45 × 409 `SEATS_FULL`, and the DB has HELD+CONFIRMED = 5.
2. **Concurrency, same student**: 20 parallel holds from one student → exactly 1 × 201.
3. **Idempotent confirm**: sequential twice → both 200 and confirmedSeats = 1. Parallel ×10 → confirmedSeats = 1.
4. **Expiry**: HOLD_DURATION_SECONDS=2 and a 1-seat class. Hold, wait about 4s with no API writes, then GET /classes shows available = 1 and GET hold shows EXPIRED. Another student can now hold, and confirming the expired hold → 409.
5. **One active hold per class**: second hold → 409. Cancel → re-apply → 201. A different class → 201.
6. **Bad input → 400**: missing/short/alpha header, malformed JSON, empty name, totalSeats 0/-1/1.5/"x", malformed ids. Plus 404s and 403.
7. **Contract shape**: field names and the `Z` suffix on `expiresAt`.

**Frontend** (Vitest + React Testing Library): countdown reaching 0 → EXPIRED with Pay disabled, the error-code → message map, student ID validation, and the ID persisting across a remount (reload).

**Verification before claiming done**: `docker compose down -v && docker compose up --build` from a clean state, curl through every endpoint and rule, then down/up again and check the data survived.

## 10. Out of scope

Authentication, payments, class edit/delete, waitlists, i18n (the UI is English), and stock imagery.
