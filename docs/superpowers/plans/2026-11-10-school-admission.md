# School Admission System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A first-come-first-served school admission system (seat hold → pay → confirm, with auto-expiry) built as a .NET 8 API, PostgreSQL and a React UI, started by a single `docker compose up`.

**Architecture:** One ASP.NET Core 8 minimal-API project. Every rule-bearing transaction lives in `AdmissionService`, which locks the class row (`SELECT … FOR UPDATE`) before counting or changing holds. A `BackgroundService` sweeps expired holds, and reads compute effective status from DB `now()`. The React 18 + Vite SPA polls the API and is served by nginx with runtime `config.js`.

**Tech Stack:** .NET 8, EF Core 8 + Npgsql.EntityFrameworkCore.PostgreSQL 8, xUnit, Microsoft.AspNetCore.Mvc.Testing 8, Testcontainers.PostgreSql, PostgreSQL 16, React 18, TypeScript, Vite, react-router-dom 6, Vitest + React Testing Library, nginx, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-11-10-school-admission-design.md`

## Global Constraints

- No .NET SDK and no host `npm install`. Every build, test and EF command runs in Docker. The repo lives on an **exFAT** drive with no symlinks, and macOS sprinkles `._*` files everywhere.
- All Docker image builds `COPY` sources, with each `.dockerignore` excluding `**/._*`, `**/bin`, `**/obj`, `**/node_modules`, `**/dist`.
- `backend/Directory.Build.props` removes `**/._*` from `Compile`/`None`/`Content`. `tsconfig` and `vitest` exclude `**/._*`.
- Backend listens on `http://+:8080`. Config keys: `ConnectionStrings__Default`, `HOLD_DURATION_SECONDS` (default 600; invalid or ≤0 → 600), `SWEEP_INTERVAL_SECONDS` (default 2), `CORS_ORIGINS` (comma-separated, default `http://localhost:3000`).
- Connection string adds `Maximum Pool Size=50;Timeout=30`. Postgres runs with `max_connections=200`.
- IDs: `c_` / `h_` + `Guid.ToString("N")`. Anything unparseable → 400 `INVALID_ID`.
- Student header `X-Student-Id`: exactly `^[0-9]{17}$` → otherwise 400 `INVALID_STUDENT_ID`.
- Name: trimmed, 1–200 chars. totalSeats: JSON integer 1–100000. Otherwise 400 `VALIDATION_ERROR`.
- Error body `{ "error": CODE, "message": text }`. Codes: `VALIDATION_ERROR`, `INVALID_STUDENT_ID`, `INVALID_ID`, `FORBIDDEN`, `CLASS_NOT_FOUND`, `HOLD_NOT_FOUND`, `NOT_FOUND`, `SEATS_FULL`, `ALREADY_APPLIED`, `HOLD_EXPIRED`, `HOLD_CANCELLED`, `HOLD_NOT_ACTIVE`, `SERVICE_BUSY` (503), `INTERNAL` (500).
- `expiresAt` is always a string formatted `yyyy-MM-dd'T'HH:mm:ss'Z'` in UTC.
- All expiry decisions use DB `now()`, read inside the same transaction.
- Lock order is always the class row, then the hold row.
- Frontend at `http://localhost:3000`. API base comes from `window.__CONFIG__.API_BASE_URL`, written from env `API_BASE_URL`, default `http://localhost:8080`.
- No UI library. Plain CSS with custom-property tokens. Works at 360px wide. Respects `prefers-reduced-motion`.
- Commit messages carry **no** `Co-Authored-By: Claude` trailer (user instruction). After any task where the AI got something wrong, append a row to `AI_USAGE.md`.

## Review Focus

1. **`._*` AppleDouble files on exFAT get compiled or collected as tests.** Builds must ignore them. Task 1 Step 5 checks that `docker build` succeeds with a stray binary `backend/src/Admission.Api/._Junk.cs` present. Task 8 Step 4 checks that the frontend tests pass with a stray `frontend/src/._junk.test.ts`.
2. **A burst exhausts the Npgsql pool.** Expected: 503 `SERVICE_BUSY`, not 500 and not a hang. Task 2 adds middleware mapping for `NpgsqlException` with `InnerException is TimeoutException` and for the pool-exhausted `InvalidOperationException`. Unit test: `ErrorHandlingMiddlewareTests.PoolTimeout_Returns503`.
3. **Out-of-range JSON numbers** (`1e20`, `120.0`, `"120"`, `null`) for totalSeats should give 400, not 500 and not silent coercion. Task 2 adds these to `ClassValidationTests` as theory rows.
4. **A wrong client clock** (phone set 5 minutes fast) must not show an expired hold early. Task 12 adds `useCountdown` tests with `serverOffsetMs = -300000`.
5. **Server down at first page load, or a student changing ID mid-session.** The page must show the banner or a friendly 403 text, never a blank page. Task 10 adds `ClassListPage` with a rejected `NETWORK` fetch → banner text present. Task 12 adds pay → `FORBIDDEN` → message "This application belongs to a different student…".

---

## Command reference (used by every task)

```bash
# Backend tests (rebuilds the test image; Testcontainers uses the mounted docker socket)
docker compose --profile tests run --rm --build backend-tests
# Single test
docker compose --profile tests run --rm --build backend-tests --filter "FullyQualifiedName~ClassEndpointsTests"
# EF migration (writes files back to the host)
docker run --rm -v "$PWD/backend:/src" -w /src mcr.microsoft.com/dotnet/sdk:8.0 bash -lc \
  'dotnet tool install -g dotnet-ef --version 8.0.* >/dev/null; export PATH=$PATH:/root/.dotnet/tools; \
   dotnet ef migrations add <Name> -p src/Admission.Api -o Data/Migrations; find . -name "._*" -delete'
# Frontend tests
docker compose --profile tests run --rm --build frontend-tests
# Full stack
docker compose up --build -d && curl -s localhost:8080/classes
```

`backend-tests` uses `backend/Dockerfile.test` (sdk:8.0, restore layer cached, `ENTRYPOINT ["dotnet","test","--logger","console;verbosity=normal"]`). It mounts `/var/run/docker.sock` and sets `TESTCONTAINERS_HOST_OVERRIDE=host.docker.internal` with `extra_hosts: ["host.docker.internal:host-gateway"]`.

---

### Task 1: Backend scaffold, data model, migration, test harness

**Files:**
- Create: `backend/Admission.sln`, `backend/Directory.Build.props`, `backend/.dockerignore`, `backend/Dockerfile`, `backend/Dockerfile.test`
- Create: `backend/src/Admission.Api/Admission.Api.csproj`, `Program.cs`, `Domain/SchoolClass.cs`, `Domain/Hold.cs`, `Domain/HoldStatus.cs`, `Domain/PublicId.cs`, `Data/AdmissionDbContext.cs`, `Data/Migrations/*` (generated), `Data/DatabaseMigrator.cs`
- Create: `backend/tests/Admission.Tests/Admission.Tests.csproj`, `AdmissionApiFactory.cs`, `TestData.cs`, `SchemaTests.cs`, `PublicIdTests.cs`
- Create: `docker-compose.yml` (services `db`, `backend`, `backend-tests`)

**Interfaces:**
- Produces:
  - `enum HoldStatus { HELD, CONFIRMED, EXPIRED, CANCELLED }`, stored as text.
  - `class SchoolClass { Guid Id; string Name; int TotalSeats; DateTime CreatedAt; }` mapped to table `classes`, columns `id, name, total_seats, created_at`.
  - `class Hold { Guid Id; Guid ClassId; string StudentId; HoldStatus Status; DateTime CreatedAt; DateTime ExpiresAt; DateTime? ConfirmedAt; DateTime? CancelledAt; SchoolClass Class; }` mapped to table `holds`.
  - `static class PublicId { string Class(Guid); string Hold(Guid); bool TryParseClass(string?, out Guid); bool TryParseHold(string?, out Guid); }`
  - `public partial class Program {}` so `WebApplicationFactory<Program>` can see it.
  - `static class DatabaseMigrator { Task MigrateWithRetryAsync(IServiceProvider, ILogger, int attempts = 30, TimeSpan? delay = null) }`
  - Test side: `AdmissionApiFactory : WebApplicationFactory<Program>, IAsyncLifetime` with ctor `(int holdDurationSeconds = 600)`, `string ConnectionString`, `AdmissionDbContext CreateDbContext()`. `TestData.NewStudentId(): string` returns 17 random digits, unique per call.

- [ ] **Step 1: Write the failing tests**

`PublicIdTests`:
- `Class(g)` returns `"c_" + g.ToString("N")`.
- `TryParseClass` accepts that string.
- It rejects `"h_…"`, `"c_xyz"`, `""`, `null`, `"c_" + g.ToString("D")`, and the wrong prefix.
- The same cases hold for `Hold`.

`SchemaTests` (uses `IClassFixture<AdmissionApiFactory>`):
- `TotalSeats_Zero_RejectedByCheckConstraint`: raw `INSERT INTO classes … total_seats 0` throws `PostgresException` with SqlState `23514`.
- `PartialUniqueIndex_BlocksSecondActiveHold`: two HELD rows with the same (class_id, student_id) → SqlState `23505`. A second row with status `CANCELLED` is accepted.
- `Status_Check_RejectsUnknown`: `status='FOO'` → `23514`.

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `docker compose --profile tests run --rm --build backend-tests`. Expected: build/compile failure (types missing).

- [ ] **Step 3: Implement**
- Projects target `net8.0`, nullable enabled.
- `AdmissionDbContext` configures:
  - snake_case table and column names;
  - `HasCheckConstraint("ck_classes_total_seats_positive", "total_seats > 0")`;
  - `HasCheckConstraint("ck_holds_status", "status IN ('HELD','CONFIRMED','EXPIRED','CANCELLED')")`;
  - unique index `ux_holds_active_class_student` on (ClassId, StudentId) `.HasFilter("status IN ('HELD','CONFIRMED')")`;
  - indexes `ix_holds_class_status`, `ix_holds_student`, and `ix_holds_expiring` on ExpiresAt with filter `status = 'HELD'`;
  - `student_id` as `char(17)`, `name` as `varchar(200)`.
- `Program.cs` registers the DbContext from `ConnectionStrings:Default` and calls `DatabaseMigrator.MigrateWithRetryAsync` before `app.Run()`.
- Generate migration `InitialSchema` with the EF command from the reference.
- `Dockerfile`: multi-stage sdk:8.0 restore/publish → aspnet:8.0, `ENV ASPNETCORE_URLS=http://+:8080`, `EXPOSE 8080`.
- Compose `db`: `postgres:16-alpine`, env `POSTGRES_DB=admission POSTGRES_USER=admission POSTGRES_PASSWORD=admission`, `command: ["postgres","-c","max_connections=200"]`, volume `pgdata:/var/lib/postgresql/data`, healthcheck `pg_isready -U admission -d admission` (interval 2s, retries 30).
- Compose `backend`: `depends_on: db: condition: service_healthy`, `restart: unless-stopped`, `ports: ["8080:8080"]`, `ConnectionStrings__Default=Host=db;Port=5432;Database=admission;Username=admission;Password=admission;Maximum Pool Size=50;Timeout=30`, `HOLD_DURATION_SECONDS=${HOLD_DURATION_SECONDS:-600}`.

- [ ] **Step 4: Run the tests and confirm they pass**

Run the backend tests. Expected: all of `PublicIdTests` and `SchemaTests` pass.

- [ ] **Step 5: Check build hygiene (Review Focus 1)**

Run `printf 'garbage\x00' > backend/src/Admission.Api/._Junk.cs && docker compose build backend && rm backend/src/Admission.Api/._Junk.cs`. Expected: the build succeeds.

- [ ] **Step 6: Commit**

`feat(backend): scaffold API, schema with check/partial-unique constraints, Testcontainers harness`

---

### Task 2: Error handling, validation, class endpoints

**Files:**
- Create: `backend/src/Admission.Api/Errors/ApiException.cs`, `ErrorCodes.cs`, `ErrorHandlingMiddleware.cs`, `Validation.cs`
- Create: `backend/src/Admission.Api/Services/AdmissionService.cs` (class methods only), `Services/AdmissionOptions.cs`, `Services/Views.cs`
- Create: `backend/src/Admission.Api/Endpoints/ClassEndpoints.cs`, `Endpoints/Dtos.cs`
- Modify: `Program.cs` (JSON camelCase, middleware, CORS, 404 fallback, endpoints)
- Test: `backend/tests/Admission.Tests/ClassEndpointsTests.cs`, `ClassValidationTests.cs`, `ErrorHandlingMiddlewareTests.cs`

**Interfaces:**
- Consumes: Task 1 entities, `PublicId`, `AdmissionApiFactory`.
- Produces:
  - `class ApiException(int StatusCode, string Code, string Message) : Exception`
  - `static class ErrorCodes` with const strings for every code in Global Constraints.
  - `static class Validation`:
    - `Task<JsonElement> ReadJsonObjectAsync(HttpRequest)` throws 400 `VALIDATION_ERROR` on empty, malformed or non-object input.
    - `string RequireStudentId(HttpRequest)`
    - `Guid RequireClassId(string)`
    - `Guid RequireHoldId(string)`
    - `(string Name, int TotalSeats) ParseCreateClass(JsonElement)`
  - `record ClassView(Guid Id, string Name, int TotalSeats, int HeldSeats, int ConfirmedSeats, int AvailableSeats)`
  - `AdmissionService` (scoped):
    - `Task<ClassView> CreateClassAsync(string name, int totalSeats)`
    - `Task<IReadOnlyList<ClassView>> ListClassesAsync()` (ordered by CreatedAt, then Id)
    - `Task<ClassView> GetClassAsync(Guid id)` (404 `CLASS_NOT_FOUND`)
  - `AdmissionOptions { TimeSpan HoldDuration; TimeSpan SweepInterval; string[] CorsOrigins; static AdmissionOptions FromConfiguration(IConfiguration) }`
  - DTOs: `ClassResponse(id, name, totalSeats)` and `ClassStatsResponse(id, name, totalSeats, heldSeats, confirmedSeats, availableSeats)`, with ids formatted by `PublicId`.

- [ ] **Step 1: Write the failing tests**

`ClassEndpointsTests`:
- `Create_Returns201WithContractShape`: POST `{"name":"Class 6 - Morning Shift","totalSeats":120}` → 201. The body has exactly keys `id`, `name`, `totalSeats`, `id` starts with `c_`, the name is unchanged, and seats = 120.
- `Create_TrimsName`: `"  Class 7  "` → `"Class 7"`.
- `List_IncludesCreatedClassWithZeroCounts`: heldSeats 0, confirmedSeats 0, availableSeats 120.
- `Get_ReturnsSameShapeAsListItem`.
- `Get_Unknown_404_CLASS_NOT_FOUND`: uses a valid-format random id.
- `Get_MalformedId_400_INVALID_ID`: `/classes/abc`.
- `UnknownRoute_404_JsonError`: GET `/nope` → 404 with `error == "NOT_FOUND"`.
- `DuplicateNames_Allowed`: two creates with the same name → both 201.

`ClassValidationTests` (Theory → 400 `VALIDATION_ERROR` with a non-empty `message`):
- body `""`, `"{"`, `"[]"`, `"null"`, `{}`;
- name missing, `""`, `"   "`, `123`, or 201 characters long;
- totalSeats missing, `0`, `-1`, `1.5`, `"120"`, `true`, `null`, `1e20`, `100001`.
- `120.0` → 400, because it isn't an integer token. Check with `JsonElement.TryGetInt32` plus a raw-text check that the token has no `.` or `e`.
- totalSeats `100000` → 201.

`ErrorHandlingMiddlewareTests` (unit, `DefaultHttpContext`):
- `ApiException` → its status and body.
- `NpgsqlException` with a `TimeoutException` inner → 503 `SERVICE_BUSY`.
- `InvalidOperationException("…pool…exhausted…")` → 503.
- `BadHttpRequestException` → 400 `VALIDATION_ERROR`.
- Anything else → 500 `INTERNAL`, and the message never leaks exception text.

- [ ] **Step 2: Run the tests and confirm they fail**

Run with `--filter "FullyQualifiedName~Class|FullyQualifiedName~ErrorHandling"`. Expected: compile failure / 404s.

- [ ] **Step 3: Implement**
- Counts come from one SQL aggregate per class set:
  - held = `status='HELD' AND expires_at > now()`
  - confirmed = `status='CONFIRMED'`
  - available = `GREATEST(total - held - confirmed, 0)`
- 404 fallback: `app.MapFallback` writes `NOT_FOUND`.
- CORS policy allows the origins from `CORS_ORIGINS`, any header (needs `X-Student-Id`) and any method, and uses `WithExposedHeaders("Date")`.

- [ ] **Step 4: Run the tests and confirm they pass.** Then run the full backend suite. Expected: all green.

- [ ] **Step 5: Commit**

`feat(backend): class endpoints with strict validation and JSON error middleware`

---

### Task 3: Create hold with class-row locking (the concurrency core)

**Files:**
- Modify: `Services/AdmissionService.cs`, `Services/Views.cs`, `Endpoints/Dtos.cs`
- Create: `Endpoints/HoldEndpoints.cs`
- Test: `backend/tests/Admission.Tests/CreateHoldTests.cs`, `ConcurrencyTests.cs`

**Interfaces:**
- Consumes: Task 2 `Validation`, `ApiException`, `AdmissionOptions.HoldDuration`.
- Produces:
  - `record HoldView(Guid Id, Guid ClassId, string ClassName, string StudentId, HoldStatus Status, DateTime ExpiresAt)`
  - `AdmissionService.CreateHoldAsync(Guid classId, string studentId) : Task<HoldView>`
  - `private Task<DateTime> DbNowAsync()` returns `SELECT now()` inside the current transaction.
  - `private Task<SchoolClass?> LockClassAsync(Guid id)` uses `FromSqlInterpolated("SELECT * FROM classes WHERE id = {id} FOR UPDATE")`.
  - `private Task ExpireStaleInClassAsync(Guid classId)`
  - `static string Utc.Format(DateTime)` returns `yyyy-MM-ddTHH:mm:ssZ`. It lives in `Endpoints/Dtos.cs` and is reused by every hold DTO.
  - `CreateHoldResponse(holdId, classId, studentId, status, expiresAt)`; extra field `className` is allowed.

- [ ] **Step 1: Write the failing tests**

`CreateHoldTests`:
- `Hold_Returns201ContractShape`: keys `holdId` (starts with `h_`), `classId`, `studentId`, `status == "HELD"`, `expiresAt` matches `^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$`, and expiresAt minus the request time is within 600±5 s.
- `Hold_IncrementsHeldSeats`
- `Hold_LastSeat_ThenNext409_SEATS_FULL` (a 1-seat class)
- `Hold_SameStudentSameClass_409_ALREADY_APPLIED`
- `Hold_SameStudentDifferentClass_201`
- `Hold_MissingHeader_400_INVALID_STUDENT_ID`, plus Theory: `"123"`, `"1234567890123456a"`, 18 digits, `" 12345678901234567"`, `"１２３…"` (full-width digits)
- `Hold_UnknownClass_404`, `Hold_MalformedClassId_400`

`ConcurrencyTests`:
- `ManyStudents_SmallClass_ExactlyNSucceed`:
  - totalSeats 5, 50 distinct students, all requests released together by a `Barrier`/`TaskCompletionSource` gate, then `Task.WhenAll`.
  - Assert count(201) == 5 and count(409) == 45, all 409 bodies have `error == "SEATS_FULL"`, no other statuses appear, a DB query shows `count(*) WHERE status IN ('HELD','CONFIRMED') == 5`, and GET class shows `availableSeats == 0`.
- `SameStudent_Parallel_OnlyOneHold`: 20 parallel holds from one student on a 10-seat class → exactly one 201 and nineteen 409 `ALREADY_APPLIED`.
- `ManyClasses_Parallel_NoCrossTalk`: 3 classes × 3 seats, 30 students each picking class `i % 3` → exactly 3 per class.

- [ ] **Step 2: Run the tests and confirm they fail**

Run with `--filter "FullyQualifiedName~CreateHold|FullyQualifiedName~Concurrency"`. Expected: 404/405 on the route.

- [ ] **Step 3: Implement `CreateHoldAsync`**

This is the exact algorithm from spec §5. Use `BeginTransactionAsync(IsolationLevel.ReadCommitted)`. Compute `expiresAt = dbNow + HoldDuration`, with the duration truncated to whole seconds. Catch `DbUpdateException` whose inner `PostgresException.SqlState == "23505"` and turn it into 409 `ALREADY_APPLIED`.

Validation order for the route: classId format → header → service.

- [ ] **Step 4: Run the tests and confirm they pass.** Run the concurrency tests 3 times in a row. Expected: green every time.

- [ ] **Step 5: Commit**

`feat(backend): seat hold with FOR UPDATE class lock, concurrency tests`

---

### Task 4: Get, confirm and cancel holds

**Files:**
- Modify: `Services/AdmissionService.cs`, `Endpoints/HoldEndpoints.cs`, `Endpoints/Dtos.cs`
- Test: `backend/tests/Admission.Tests/HoldLifecycleTests.cs`

**Interfaces:**
- Consumes: Task 3 `LockClassAsync`, `DbNowAsync`, `HoldView`.
- Produces:
  - `AdmissionService.GetHoldAsync(Guid holdId) : Task<HoldView>`: effective status, 404 `HOLD_NOT_FOUND`.
  - `AdmissionService.ConfirmAsync(Guid holdId, string studentId) : Task<HoldView>`
  - `AdmissionService.CancelAsync(Guid holdId, string studentId) : Task`
  - `private Task<Hold?> LockHoldAsync(Guid holdId)`: `FOR UPDATE`.
  - `static HoldStatus EffectiveStatus(Hold h, DateTime dbNow)`
  - DTOs `HoldResponse(holdId, classId, status, expiresAt)` with extras `className` and `studentId`, and `ConfirmResponse(holdId, status)`.

- [ ] **Step 1: Write the failing tests** (`HoldLifecycleTests`)
- `GetHold_NoHeaderNeeded_ReturnsShape`: keys `holdId`, `classId`, `status`, `expiresAt`.
- `GetHold_Unknown_404`, `GetHold_Malformed_400`
- `Confirm_Own_200_Confirmed_CountsMove`: held 1→0, confirmed 0→1.
- `Confirm_Twice_Sequential_Idempotent`: both 200 `CONFIRMED`, confirmedSeats == 1.
- `Confirm_Parallel10_Idempotent`: all 200, confirmedSeats == 1.
- `Confirm_OtherStudent_403_FORBIDDEN`, `Confirm_MissingHeader_400`
- `Confirm_Cancelled_409_HOLD_CANCELLED`
- `Cancel_Own_204_SeatReleased_CanReapply`: then hold again → 201.
- `Cancel_Confirmed_409_HOLD_NOT_ACTIVE`, `Cancel_Twice_SecondIs409`, `Cancel_OtherStudent_403`
- `ConfirmAndCancel_Race_ExactlyOneWins`: run 20 iterations. Each one fires confirm and cancel in parallel on a fresh hold. Exactly one succeeds (200 or 204), the other gets 409, and the final status matches the winner.

- [ ] **Step 2: Run the tests and confirm they fail.** Expected: 404/405.

- [ ] **Step 3: Implement**

Read the hold's `class_id` with no tracking (404 if missing). Then do `LockClassAsync` → `LockHoldAsync` → the decision table in spec §5. If a HELD hold has passed its expiry, persist EXPIRED and **commit** before throwing 409 `HOLD_EXPIRED`.

- [ ] **Step 4: Run the tests and confirm they pass.** Then run the full backend suite.

- [ ] **Step 5: Commit**

`feat(backend): get/confirm/cancel holds with ordered row locks, idempotent confirm`

---

### Task 5: Automatic expiry (sweeper and effective status)

**Files:**
- Create: `Services/ExpirySweeper.cs`
- Modify: `Services/AdmissionService.cs` (add `ExpireStaleAsync`), `Program.cs` (register hosted service)
- Test: `backend/tests/Admission.Tests/ExpiryTests.cs`, `AdmissionOptionsTests.cs`

**Interfaces:**
- Consumes: `AdmissionOptions.SweepInterval`, `AdmissionApiFactory(holdDurationSeconds: 2)`.
- Produces:
  - `AdmissionService.ExpireStaleAsync() : Task<int>`: a single `UPDATE … WHERE status='HELD' AND expires_at <= now()`.
  - `class ExpirySweeper : BackgroundService` creates a scope per tick, catches and logs every exception, and uses `PeriodicTimer`.

- [ ] **Step 1: Write the failing tests**

`ExpiryTests` uses its own `AdmissionApiFactory(2)` fixture with `SWEEP_INTERVAL_SECONDS=1`:
- `Expiry_ReleasesSeat_WithoutApiCalls`:
  - A 1-seat class. Student A holds it. Wait 4 s with no requests.
  - A raw DB query (not the API) shows status `EXPIRED`, proving the sweeper persisted it.
  - GET class shows available 1 and held 0.
  - Student B holds → 201.
- `Expired_ConfirmIs409_HOLD_EXPIRED_AndCountsUnchanged`
- `Expired_GetShowsEXPIRED`
- `Expired_SameStudentCanReapply`: A again → 201.

`AdmissionOptionsTests`:
- `HOLD_DURATION_SECONDS` missing → 600; `"30"` → 30; `"abc"` / `"0"` / `"-5"` → 600.
- CORS default `["http://localhost:3000"]`.
- A comma list is split and trimmed.

- [ ] **Step 2: Run the tests and confirm they fail.** Expected: the DB status stays `HELD`.
- [ ] **Step 3: Implement**, then register with `AddHostedService<ExpirySweeper>()`.
- [ ] **Step 4: Run the tests and confirm they pass.** Then run the full suite.
- [ ] **Step 5: Commit**

`feat(backend): background expiry sweeper; seat released without API calls`

---

### Task 6: GET /me/holds

**Files:**
- Create: `Endpoints/MeEndpoints.cs`
- Modify: `Services/AdmissionService.cs`
- Test: `backend/tests/Admission.Tests/MyHoldsTests.cs`

**Interfaces:**
- Produces:
  - `AdmissionService.ListStudentHoldsAsync(string studentId) : Task<IReadOnlyList<HoldView>>`, newest first, with effective status.
  - `MyHoldResponse(holdId, classId, className, status, expiresAt)`.

- [ ] **Step 1: Write the failing tests**
- `Me_ReturnsArrayOfOwnHoldsOnly_NewestFirst`: two classes held by A and one by B, so A sees 2.
- Each item has keys `holdId`, `classId`, `className`, `status`, `expiresAt`.
- `Me_NoHolds_EmptyArray`, `Me_MissingHeader_400`
- `Me_IncludesConfirmedAndCancelled`

- [ ] **Step 2: Run the tests and confirm they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the tests and confirm they pass.** Then run the full suite.
- [ ] **Step 5: Commit**

`feat(backend): GET /me/holds returns all of a student's applications`

---

### Task 7: Compose stack end-to-end and the backend2 bonus

**Files:**
- Modify: `docker-compose.yml` (add `backend2` under profile `bonus`, port `8081:8080`)
- Create: `scripts/smoke.sh` (curl walk-through, used again in Task 15), `scripts/two-process-race.sh`

**Interfaces:**
- Produces:
  - `scripts/smoke.sh [API=http://localhost:8080]` exits non-zero on any unexpected status.
  - `scripts/two-process-race.sh` sends 60 holds alternating between :8080 and :8081 against a 5-seat class, using `curl` in parallel via `xargs -P 60`, and prints the status counts.

- [ ] **Step 1: Write the smoke script.**

It checks each step's status code:
create class 201 → list 200 → hold 201 → duplicate hold 409 → confirm 200 → confirm again 200 → cancel the confirmed hold 409 → bad header 400 → malformed JSON 400 → `/me/holds` 200 array.

- [ ] **Step 2: Run it against a clean stack.**

Run `docker compose down -v && docker compose up --build -d && ./scripts/smoke.sh`. Expected: `ALL OK`.

- [ ] **Step 3: Check persistence**

Run `docker compose down && docker compose up -d`, then GET `/classes`. Expected: the class from step 2 is still present with confirmedSeats 1.

- [ ] **Step 4: Run the two-process check**

Run `docker compose --profile bonus up -d && ./scripts/two-process-race.sh`. Expected: exactly `201 x5`, `409 x55`.

- [ ] **Step 5: Commit**

`chore: smoke and two-process race scripts; backend2 compose profile`

---

### Task 8: Frontend scaffold, runtime config, API client and error copy

**Files:**
- Create: `frontend/package.json`, `package-lock.json` (generated in a container), `vite.config.ts`, `tsconfig.json`, `index.html`, `.dockerignore`, `Dockerfile` (stages `deps`, `test`, `build`, `runtime`), `nginx.conf` (SPA fallback `try_files $uri /index.html`, `config.js` with `Cache-Control: no-store`), `docker-entrypoint.d/40-config.sh`, `public/config.js` (dev default)
- Create: `frontend/src/main.tsx`, `src/config.ts`, `src/api/types.ts`, `src/api/client.ts`, `src/api/endpoints.ts`, `src/api/messages.ts`, `src/test/setup.ts`
- Modify: `docker-compose.yml` (add `frontend` on 3000:80 with `API_BASE_URL`, and `frontend-tests` with profile `tests`, built from target `test`)
- Test: `frontend/src/api/messages.test.ts`, `frontend/src/api/client.test.ts`

**Interfaces:**
- Produces:
  - `config.ts`: `apiBaseUrl(): string`, from `window.__CONFIG__?.API_BASE_URL` with the trailing slash trimmed, falling back to `http://localhost:8080`.
  - `api/types.ts`:
    - `HoldStatus = 'HELD'|'CONFIRMED'|'EXPIRED'|'CANCELLED'`
    - `ClassStats {id,name,totalSeats,heldSeats,confirmedSeats,availableSeats}`
    - `Hold {holdId,classId,status,expiresAt,className?,studentId?}`
    - `MyHold {holdId,classId,className,status,expiresAt}`
  - `api/client.ts`:
    - `class ApiError extends Error { code: string; status: number }`, where code `'NETWORK'` means status 0.
    - `apiRequest<T>(path: string, opts?: {method?: string; body?: unknown; studentId?: string; signal?: AbortSignal}): Promise<T>`, with 204 → `undefined`.
    - `serverNow(): number`, which is `Date.now() + serverOffsetMs`. The offset is updated from each response's `Date` header.
    - `subscribeConnection(cb: (online: boolean) => void): () => void`, which marks the app offline on a `NETWORK` error and online on any HTTP response.
  - `api/endpoints.ts`: `listClasses()`, `getClass(id)`, `createClass(name, totalSeats)`, `createHold(classId, sid)`, `getHold(id)`, `confirmHold(id, sid)`, `cancelHold(id, sid)`, `listMyHolds(sid)`
  - `api/messages.ts`: `friendlyError(err: unknown): string`

- [ ] **Step 1: Write the failing tests**

`messages.test.ts`, with exact copy (these strings are the spec's copy):

| Code | Text |
|---|---|
| `SEATS_FULL` | "All seats in this class are taken. Try another class or shift." |
| `ALREADY_APPLIED` | "You already have an active application or admission in this class. Check My applications." |
| `HOLD_EXPIRED` | "Your seat hold has expired and the seat was released. Apply again if seats are still available." |
| `HOLD_CANCELLED` | "This application was cancelled. Apply again if seats are still available." |
| `HOLD_NOT_ACTIVE` | "This application can no longer be cancelled." |
| `FORBIDDEN` | "This application belongs to a different student. Check the birth registration number at the top of the page." |
| `INVALID_STUDENT_ID` | "Enter the student's 17-digit birth registration number at the top of the page." |
| `VALIDATION_ERROR` | the server's own `message` |
| `CLASS_NOT_FOUND` | "This class no longer exists. Go back to the class list." |
| `HOLD_NOT_FOUND` | "We couldn't find this application. Open it from My applications." |
| `SERVICE_BUSY` | "The admission server is very busy right now. Please try again in a few seconds." |
| `NETWORK` | "Can't reach the admission server. Check your connection; we'll keep retrying." |
| unknown code / non-ApiError | "Something went wrong on our side. Please try again." |

`client.test.ts` (mocked `fetch`):
- 409 JSON → rejects with `ApiError{code:'SEATS_FULL',status:409}`.
- `fetch` throws `TypeError` → `ApiError{code:'NETWORK',status:0}`.
- A non-JSON 502 body → code `'INTERNAL'`.
- A response with `Date` 5 minutes ahead of the mocked `Date.now` → `serverNow()` is ≈ +300000.
- `studentId` is sent as the `X-Student-Id` header.
- 204 resolves to `undefined`.

- [ ] **Step 2: Generate the lockfile**

Run `docker run --rm -v "$PWD/frontend:/app" -w /app node:20-alpine npm install --package-lock-only`. Then confirm the tests fail with `docker compose --profile tests run --rm --build frontend-tests`. Expected: missing modules.

- [ ] **Step 3: Implement**

The entrypoint writes:
```
window.__CONFIG__ = { API_BASE_URL: "<value>" };
```
to `/usr/share/nginx/html/config.js`, with the value JSON-escaped via `sed`. `index.html` loads `/config.js` before the module script. tsconfig `exclude` and vitest `exclude` contain `**/._*`.

- [ ] **Step 4: Run the tests and confirm they pass.** Check build hygiene (Review Focus 1) with a stray `src/._junk.test.ts`: the tests still pass.

- [ ] **Step 5: Commit**

`feat(frontend): Vite scaffold, runtime config.js, API client with server clock and friendly errors`

---

### Task 9: Style lock, tokens, app shell, student bar

**Files:**
- Create: `docs/style-lock.md` (tastemaker output: palette with contrast ratios, type, spacing and radius scales)
- Create: `frontend/src/styles/tokens.css`, `styles/base.css`, `src/App.tsx` (router and layout), `src/components/Layout.tsx`, `src/components/StudentBar.tsx`, `src/state/StudentContext.tsx`, `src/lib/studentId.ts`
- Test: `frontend/src/lib/studentId.test.ts`, `frontend/src/components/StudentBar.test.tsx`

**Interfaces:**
- Produces:
  - `lib/studentId.ts`: `isValidStudentId(s: string): boolean` (`/^\d{17}$/`) and `sanitizeStudentIdInput(s: string): string` (strip non-ASCII-digits, cap at 17).
  - `StudentContext`: `useStudent(): { studentId: string | null; setStudentId(id: string): void; clearStudentId(): void }`. Persists to localStorage key `admission.studentId`, wrapped in try/catch.
  - Routes `/`, `/admin`, `/holds/:holdId`, `/me`, and `*` (a not-found page with a link home).
  - `<RequireStudentHint/>` is an inline hint component reused by the pages.

- [ ] **Step 0: Lock the style**

Read `.agents/skills/tastemaker/SKILL.md` and `.agents/skills/web-design-engineer/SKILL.md`, then lock the style into `docs/style-lock.md`:
- An official-but-friendly school portal look.
- 1 primary hue plus semantic success, warning and danger colors.
- Every text/background pair at least 4.5:1.
- A system font stack, an 8px spacing scale, and a radius scale of 4/8/12.
- No stock imagery and no icon fetching.

- [ ] **Step 1: Write the failing tests**
- `studentId.test`: valid 17 digits; invalid 16 or 18 digits; letters, spaces and full-width digits are invalid; sanitize turns `"2015-269 1234567890xyz"` into `"20152691234567890"`.
- `StudentBar.test`:
  - Typing 12 digits shows "12/17" and Save is disabled.
  - At 17 digits, Save is enabled.
  - Saving stores the ID in localStorage.
  - Remounting the app restores the ID and shows it with a "Change student" button (persistence across reload).
  - "Change student" clears it and focuses the input.

- [ ] **Step 2: Run the tests and confirm they fail.**
- [ ] **Step 3: Implement.** The bar is sticky, with an `<input inputMode="numeric" autoComplete="off">` and a `<label>`, and the counter uses `aria-live="polite"` only when the count reaches 17 or becomes invalid.
- [ ] **Step 4: Run the tests and confirm they pass.**
- [ ] **Step 5: Commit**

`feat(frontend): style lock, design tokens, layout, persistent student ID bar`

---

### Task 10: Polling, connection banner, class list

**Files:**
- Create: `src/hooks/usePolling.ts`, `src/components/ConnectionBanner.tsx`, `src/components/SeatBar.tsx`, `src/components/Skeleton.tsx`, `src/components/ErrorBoundary.tsx`, `src/pages/ClassListPage.tsx`, `src/hooks/useMyHolds.ts`
- Test: `src/hooks/usePolling.test.ts`, `src/pages/ClassListPage.test.tsx`

**Interfaces:**
- Consumes: `api/endpoints`, `subscribeConnection`, `useStudent`, `friendlyError`.
- Produces:
  - `usePolling<T>(fn: (signal: AbortSignal) => Promise<T>, intervalMs: number, deps?: unknown[]): { data: T | undefined; error: unknown; lastUpdated: number | null; refresh(): Promise<void> }`. It skips ticks while `document.hidden`, refetches immediately on `visibilitychange` to visible and on `focus`, and keeps the last data when an error occurs.
  - `useMyHolds(): ReturnType<usePolling<MyHold[]>>`, which polls every 5 s and does nothing without a student ID.
  - `<SeatBar total held confirmed />` renders an accessible text summary plus decorative stacked segments.

- [ ] **Step 1: Write the failing tests**
- `usePolling.test` (fake timers): calls fn at 0, 3000 and 6000 ms; makes no calls while `document.hidden` is true; calls immediately on becoming visible.
- `ClassListPage.test`:
  - Renders skeletons, then cards with the name and "25 of 120 available".
  - `availableSeats 0` shows "Full" and a disabled Apply button.
  - Without a student ID, Apply is disabled and the hint "Enter the student's birth registration number above to apply" is shown.
  - When the student has a HELD hold in that class, a "View your application" link to `/holds/h_x` replaces Apply.
  - A `NETWORK` rejection shows the banner "Can't reach the admission server. Retrying…" (Review Focus 5), and the page isn't blank.
  - No classes → "No classes are open for admission yet." with a link to the admin page.
  - Applying with `SEATS_FULL` shows the friendly copy inline on that card.
  - Apply navigates to `/holds/:holdId` on 201.
  - While in flight the button reads "Applying…" and is disabled.

- [ ] **Step 2: Run the tests and confirm they fail.**
- [ ] **Step 3: Implement.**
  - Poll every 3 s.
  - "Updated Xs ago" is driven by a 1 s ticker, and switches to "Reconnecting…" while offline.
  - Numbers use `font-variant-numeric: tabular-nums`.
  - The aria-live region announces only when a class becomes Full or reopens.
  - Wrap `App` in an `ErrorBoundary` with a friendly fallback and a reload button.
- [ ] **Step 4: Run the tests and confirm they pass.**
- [ ] **Step 5: Commit**

`feat(frontend): live class list with seat bars, polling, offline banner`

---

### Task 11: Admin create-class page

**Files:**
- Create: `src/pages/AdminPage.tsx`
- Test: `src/pages/AdminPage.test.tsx`

**Interfaces:**
- Consumes: `createClass`, `friendlyError`.

- [ ] **Step 1: Write the failing tests**
- Empty name → "Enter a class name, e.g. Class 6 – Morning Shift."
- Seats `0` / `-3` / `1.5` / blank → "Seats must be a whole number from 1 to 100,000."
- Errors are linked via `aria-describedby`, and focus moves to the first invalid field.
- A valid submit calls `createClass` with the trimmed name, then shows "Class created" with a "View in class list" link, and the form resets.
- While in flight the button reads "Creating…" and is disabled.
- A server `VALIDATION_ERROR` message is shown.

- [ ] **Step 2: Run the tests and confirm they fail.** **Step 3: Implement.** The page is clearly labelled "School admin" in the nav. **Step 4: Run the tests and confirm they pass.**
- [ ] **Step 5: Commit**

`feat(frontend): admin create-class form with inline validation`

---

### Task 12: Hold page with countdown, pay and cancel

**Files:**
- Create: `src/hooks/useCountdown.ts`, `src/components/Countdown.tsx`, `src/components/StatusBadge.tsx`, `src/components/ConfirmDialog.tsx`, `src/pages/HoldPage.tsx`
- Test: `src/hooks/useCountdown.test.ts`, `src/pages/HoldPage.test.tsx`

**Interfaces:**
- Consumes: `serverNow`, `getHold`, `confirmHold`, `cancelHold`, `getClass`, `usePolling`.
- Produces:
  - `useCountdown(expiresAt: string | undefined): { remainingMs: number; isExpired: boolean; mmss: string }`, ticking every 250 ms off `serverNow()`.
  - `effectiveStatus(hold: Hold, isExpired: boolean): HoldStatus`, which returns `'EXPIRED'` when HELD and the countdown has hit zero.
  - `<StatusBadge status />` shows text plus color plus a shape glyph.

- [ ] **Step 1: Write the failing tests**
- `useCountdown.test`:
  - `expiresAt` = now + 61 s → `"01:01"`. Advancing 61 s gives `isExpired` and `"00:00"`.
  - With the server offset at −300000 (client clock 5 minutes fast, Review Focus 4) and `expiresAt` = server time + 120 s, it is not expired and reads `"02:00"`.
- `HoldPage.test` (fake timers, mocked API):
  - A HELD hold expiring in 3 s: Pay is enabled. Advancing 3 s, without any refetch resolving, shows status "Expired" and Pay is disabled or replaced (the key bonus test).
  - Under 60 s, the "Less than a minute left" text is present (not color alone).
  - Pay → "Paying…" disabled → CONFIRMED success state "Admission confirmed".
  - Double-click on Pay → `confirmHold` is called exactly once.
  - Cancel opens the confirm dialog. "Keep my seat" closes it with no call. "Yes, cancel" → `cancelHold` → status "Cancelled".
  - When EXPIRED and the class has available seats, an "Apply again" button appears. With 0 seats it says "Apply again isn't possible — this class is full."
  - Pay → `FORBIDDEN` → the friendly copy (Review Focus 5).
  - `HOLD_NOT_FOUND` → the not-found copy with a link to My applications.
  - Without a student ID, Pay and Cancel are disabled with the hint.

- [ ] **Step 2: Run the tests and confirm they fail.**
- [ ] **Step 3: Implement.**
  - Refetch the hold every 3 s.
  - The countdown is large mm:ss in tabular-nums, with `role="timer"` and `aria-live="off"`.
  - A separate polite live region announces status changes only.
  - Read `.agents/skills/emil-design-eng/SKILL.md` and add motion only for the urgency state and status transitions, under `@media (prefers-reduced-motion: no-preference)`.
- [ ] **Step 4: Run the tests and confirm they pass.**
- [ ] **Step 5: Commit**

`feat(frontend): hold page with server-synced countdown, pay/cancel, expiry handling`

---

### Task 13: My applications page

**Files:**
- Create: `src/pages/MyApplicationsPage.tsx`
- Test: `src/pages/MyApplicationsPage.test.tsx`

**Interfaces:**
- Consumes: `useMyHolds`, `useCountdown`, `StatusBadge`.

- [ ] **Step 1: Write the failing tests**
- Groups are "Active" (HELD, CONFIRMED) and "Past" (EXPIRED, CANCELLED), active first.
- A HELD item shows a live countdown and an "Open" link to `/holds/:id`.
- A HELD item whose countdown hits 0 moves to show "Expired" without a refetch.
- No student ID → hint. Empty → "No applications yet." with a "Browse classes" link.
- Network error with cached data → the data stays and the banner shows.

- [ ] **Step 2: Run the tests and confirm they fail.** **Step 3: Implement.** **Step 4: Run the tests and confirm they pass.**
- [ ] **Step 5: Commit**

`feat(frontend): my applications grouped by status with live countdowns`

---

### Task 14: UI quality pass (critique, a11y, break-ui, anti-slop)

**Files:**
- Modify: frontend components and CSS as found
- Create: `src/dev/worstCase.ts` (fixture data, used only via `?demo=worst` in dev builds)

- [ ] **Step 1: Run the stack and capture screens**

Start the stack, then screenshot each route at 360px and 1280px (headless Chromium via `docker run mcr.microsoft.com/playwright`).

- [ ] **Step 2: Run the review skills**

Read and apply `interface-review`, `better-ui`, `better-accessibility`, `better-writing` and `break-ui`, in that order. Feed in the worst cases:
- a 200-character class name;
- 0, 1 and 10,000 seats;
- 50 classes;
- an expired hold.

Fix every issue found. No horizontal scroll at 360px.

- [ ] **Step 3: Run tastemaker's anti-slop scan** against `docs/style-lock.md` and fix any drift.
- [ ] **Step 4: Re-run the frontend tests.** Expected: all green.
- [ ] **Step 5: Commit**

`style(frontend): review, a11y and worst-case data fixes`

---

### Task 15: Docs and final verification

**Files:**
- Modify: `README.md` (run with Docker, URLs, tests, env vars, bonus profile)
- Create: `ASSUMPTIONS.md` (spec §2 table plus concurrency and two-process notes)
- Modify: `AI_USAGE.md` (condense the running log)

- [ ] **Step 1: Write the docs.** The README test commands must be exactly the two `--profile tests` commands from the command reference.
- [ ] **Step 2: Verify from a clean clone (superpowers:verification-before-completion)**

First stop the dev stack with `docker compose down -v`. Then run `git clone . <scratchpad>/verify && cd <scratchpad>/verify && docker compose up --build -d`. Then:
- `./scripts/smoke.sh`;
- open `http://localhost:3000` and walk through create → apply → pay, and apply → wait (with `HOLD_DURATION_SECONDS=20`) → EXPIRED with Pay disabled;
- `docker compose down && docker compose up -d` → data still present;
- run both test profiles → all pass.

Paste the actual outputs into the final report.

- [ ] **Step 3: Commit and push** (after asking the user)

`docs: README, ASSUMPTIONS, AI_USAGE`
