# School Admission System

First-come-first-served online admission. Parents apply for a seat in a class-shift. The seat is **held** for a limited time, and paying within that time **confirms** it. Otherwise the seat returns to the pool automatically. A school admin creates classes, and parents do everything else, all from the web UI.

- **Backend:** C# / .NET 8 minimal API, EF Core + Npgsql, PostgreSQL 16
- **Frontend:** React 18 + TypeScript + Vite, plain CSS with design tokens, served by nginx
- **Everything runs in Docker.** Nothing else needs to be installed.

## Run it

```bash
docker compose up
```

| What | URL |
|---|---|
| Web app (parents and school admin) | http://localhost:3000 |
| API | http://localhost:8080 |

The first start builds the images (a few minutes). Database migrations apply automatically once PostgreSQL is healthy. Data lives in the named volume `pgdata`, so it survives `docker compose down` / `up`. `docker compose down -v` wipes it.

### Using the app

1. Open **School admin** and create a class, e.g. "Class 6 – Morning Shift" with 120 seats.
2. Enter a 17-digit birth registration number in the bar at the top. It is remembered in this browser.
3. On **Classes**, press **Apply**. The seat is held and a countdown starts.
4. Press **Pay admission fee** to confirm. Payment is simulated, so pressing the button counts as paid. If you don't pay, the hold shows EXPIRED when time runs out and the seat is released.
5. **My applications** lists every application for the student.

### Configuration

| Variable | Service | Default | Meaning |
|---|---|---|---|
| `ConnectionStrings__Default` | backend | compose `db` service | PostgreSQL connection string |
| `HOLD_DURATION_SECONDS` | backend | `600` | How long a seat stays on hold |
| `SWEEP_INTERVAL_SECONDS` | backend | `2` | How often expired holds are released |
| `CORS_ORIGINS` | backend | `http://localhost:3000` | Comma-separated allowed origins |
| `API_BASE_URL` | frontend | `http://localhost:8080` | Backend URL used by the browser (written to `config.js` at container start) |

Compose passes `HOLD_DURATION_SECONDS`, `CORS_ORIGINS` and `API_BASE_URL` through from your shell. For example, `HOLD_DURATION_SECONDS=30 docker compose up` makes expiry quick to try.

## Tests (Docker only)

```bash
# Backend: xUnit + WebApplicationFactory against a real PostgreSQL (Testcontainers)
docker compose --profile tests run --rm --build backend-tests

# Frontend: Vitest + React Testing Library
docker compose --profile tests run --rm --build frontend-tests
```

The backend test container talks to the Docker daemon through `/var/run/docker.sock` to start a throwaway PostgreSQL per test class.

**Backend highlights** (`backend/tests/Admission.Tests`):
- `ConcurrencyTests`:
  - 50 students apply at the same instant for 5 seats: exactly 5 × 201 and 45 × 409, and the database never holds more than 5.
  - The same student fires 20 parallel applications and gets exactly 1.
  - Parallel load across several classes.
- `HoldLifecycleTests`:
  - Confirm is idempotent, sequentially and with 10 parallel confirms.
  - A confirm racing a cancel is decided exactly once.
  - 403 for someone else's hold.
- `ExpiryTests`: with a 2-second hold, the background sweeper releases the seat without any API call, and a late confirm gets 409.
- `ClassValidationTests` / `CreateHoldTests`: every kind of bad input returns 400 with a JSON error, never 500.

**Frontend highlights:**
- The countdown reaching 0 shows EXPIRED and disables Pay without a reload.
- The countdown uses the server's clock, so a wrong phone clock doesn't change it.
- Every API error code maps to plain language.
- Student ID validation, and persistence across reloads.
- The offline banner, and double-click protection on Pay.

### End-to-end scripts (optional, need `curl` and bash)

```bash
./scripts/smoke.sh                       # walks every endpoint and rule against a running stack
docker compose --profile bonus up -d     # second API process on :8081, same database
./scripts/two-process-race.sh            # 60 simultaneous holds split across :8080/:8081 → 5 × 201, 55 × 409
```

## API

All JSON. The student identity comes from the `X-Student-Id` header (17 digits). Ids look like `c_<32 hex>` (class) and `h_<32 hex>` (hold). `expiresAt` is always UTC with a `Z` suffix.

| Method and path | Success | Notes |
|---|---|---|
| `POST /classes` `{name, totalSeats}` | 201 `{id, name, totalSeats}` | 400 on bad input |
| `GET /classes` | 200 `[{id, name, totalSeats, heldSeats, confirmedSeats, availableSeats}]` | |
| `GET /classes/{classId}` | 200, same shape as one list item | 404 unknown, 400 malformed id |
| `POST /classes/{classId}/holds` | 201 `{holdId, classId, studentId, status:"HELD", expiresAt}` | 409 `SEATS_FULL` / `ALREADY_APPLIED` |
| `GET /holds/{holdId}` | 200 `{holdId, classId, status, expiresAt}` | No header needed |
| `POST /holds/{holdId}/confirm` | 200 `{holdId, status:"CONFIRMED"}` | Idempotent; 403 if not yours; 409 if expired or cancelled |
| `DELETE /holds/{holdId}` | 204 | Only a HELD hold; 403 if not yours; 409 otherwise |
| `GET /me/holds` | 200 `[{holdId, classId, className, status, expiresAt}]` | All of the student's applications |

Errors are always `{ "error": "<CODE>", "message": "<text>" }`:
- **400:** `VALIDATION_ERROR`, `INVALID_STUDENT_ID`, `INVALID_ID`
- **403:** `FORBIDDEN`
- **404:** `CLASS_NOT_FOUND`, `HOLD_NOT_FOUND`, `NOT_FOUND`
- **409:** `SEATS_FULL`, `ALREADY_APPLIED`, `HOLD_EXPIRED`, `HOLD_CANCELLED`, `HOLD_NOT_ACTIVE`
- **503:** `SERVICE_BUSY`

## How the seat limit is enforced

Every hold, confirm and cancel runs in one short transaction that first locks the class row (`SELECT … FOR UPDATE`). Inside that lock the transaction:
1. releases this class's overdue holds;
2. checks that the student has no active application there;
3. counts HELD + CONFIRMED against `totalSeats`;
4. writes.

Confirm and cancel also lock the hold row, always class first, then hold, so they cannot deadlock. The lock lives in PostgreSQL, which is why the rule also holds with two API processes.

There is a second line of defence: a partial unique index on `(class_id, student_id) WHERE status IN ('HELD','CONFIRMED')`, plus `CHECK (total_seats > 0)`.

Expiry has two parts:
- **Reads** treat a HELD hold past `expires_at` as EXPIRED, so counts are right to the second.
- **A background sweeper** persists EXPIRED every 2 s.

All time decisions use the database clock. More detail is in [ASSUMPTIONS.md](ASSUMPTIONS.md) and the design spec in [docs/superpowers/specs](docs/superpowers/specs/).

## Repository layout

```
backend/    .NET solution: src/Admission.Api, tests/Admission.Tests, Dockerfile, Dockerfile.test
frontend/   React app, Dockerfile (test / build / nginx runtime stages), nginx.conf
scripts/    smoke.sh, two-process-race.sh
docs/       design spec, implementation plan, UI style lock
```
