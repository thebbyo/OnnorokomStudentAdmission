# Assumptions

Decisions taken where the brief is silent, and why.

## API and data

- **`GET /me/holds` returns an array.** The brief's example shows a single object, but the endpoint is "all of this student's applications", so it returns all of them, newest first, including confirmed, expired and cancelled ones.
- **IDs:** `c_` / `h_` followed by a 32-character hex GUID. Any id that doesn't parse is a 400 (`INVALID_ID`), not a 404, because it can't refer to anything.
- **Student id:** exactly 17 ASCII digits; leading zeros are allowed. Spaces, dashes and non-ASCII digits are rejected (400 `INVALID_STUDENT_ID`).
- **Class names are not unique.** Names are trimmed and must be 1–200 characters. Rejecting duplicates would also break anyone re-running an automated test suite that creates "Class 6 – Morning Shift" each time.
- **`totalSeats`:** a JSON integer from 1 to 100,000. `"120"`, `120.0`, `1e2`, `true` and `null` are all rejected rather than coerced.
- **No class editing or deleting.** These aren't in the API contract, so classes are append-only.
- **Extra response fields** (allowed by the brief): `className` on hold responses, `studentId` on `GET /holds/{id}`, and `classId` and `expiresAt` on the confirm response.
- **`GET /holds/{holdId}` needs no `X-Student-Id`.** The brief lists no header for it. Changing a hold (confirm or cancel) does require the header.

## Status rules

- **Re-applying:** a student may apply again to the same class after their hold there was cancelled or expired. Only HELD and CONFIRMED count as active.
- **Confirming an already CONFIRMED hold** (same student) returns 200 `CONFIRMED` and changes nothing (idempotent).
- **Expired holds:** confirm or cancel returns 409 `HOLD_EXPIRED`.
- **Cancelled holds:** confirm returns 409 `HOLD_CANCELLED`.
- **Cancel:** only a HELD hold can be cancelled. Cancelling a CONFIRMED or already cancelled hold returns 409 `HOLD_NOT_ACTIVE`. A paid admission isn't refundable through this API.
- **Another student's hold:** confirm or cancel returns 403 `FORBIDDEN`.
- **Check order:** id format, then header, then body, then existence, then ownership, then state.
- **A class that is full** returns 409 `SEATS_FULL`. If the same student already holds a seat in it, the more useful `ALREADY_APPLIED` wins.

## Time and expiry

- **All expiry decisions use the database clock**, never the API server's, so several API processes always agree.
- **Inside the seat lock, `clock_timestamp()` is used**, not `now()`. `now()` is frozen at the start of the transaction, and a request may have waited for the lock, which would shorten its hold.
- **`expires_at` is stored in whole seconds**, because the API shows whole seconds. This way the client's countdown and the server agree exactly.
- **Two-part expiry:**
  - A HELD hold past `expires_at` is reported as EXPIRED immediately, and stops counting as a held seat.
  - A background sweeper (every `SWEEP_INTERVAL_SECONDS`, default 2) writes EXPIRED to the database, so seats return without anyone calling the API.
- **An invalid `HOLD_DURATION_SECONDS`** (non-numeric or ≤ 0) falls back to the default of 600.

## Concurrency and load

- **The seat rule is enforced by a row lock on the class.** Each hold, confirm and cancel takes `SELECT … FOR UPDATE` on the class row, then counts and writes in the same transaction. This serialises changes per class only, so other classes aren't blocked.
- **A partial unique index on (class, student) for active holds is a second line of defence.** A violation becomes 409 `ALREADY_APPLIED`.
- **Bonus: two API processes.** `docker compose --profile bonus up` adds `backend2` on :8081 against the same database. Because the lock lives in PostgreSQL, rule 1 still holds. `scripts/two-process-race.sh` fires 60 simultaneous requests split across both and gets exactly 5 × 201 for 5 seats.
- **Connection pool:** 50 connections per process, and PostgreSQL `max_connections` is 200. A burst of thousands of requests queues for a connection (30 s timeout). If the pool is exhausted, the API answers 503 `SERVICE_BUSY` instead of 500, and the UI says "very busy, try again".

## UI

- **No login.** The 17-digit number in the top bar is the identity and is saved in `localStorage`. Anyone can open School admin, because the brief asks for no login.
- **Payment is simulated.** Pressing "Pay admission fee" calls confirm.
- **Countdowns use the server's clock.** The offset comes from the HTTP `Date` header, so a phone with a wrong clock can't show a hold as active after it expired, or the reverse.
- **Polling, not push:**
  - The class list refreshes every 3 s.
  - The open application refreshes every 3 s.
  - My applications refreshes every 5 s.
  - Polling pauses in background tabs and refreshes immediately on return.
- **UI language is English.** The brief's UI labels are Bengali, but the API, codes and evaluation are in English. All copy is in one place (`frontend/src/api/messages.ts` plus the pages), so translating later is straightforward.
