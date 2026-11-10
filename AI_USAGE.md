# AI usage

## Tools

- **Claude Code** (Claude Opus 5.5), in VS Code.
- Process skills: superpowers brainstorming, writing-plans, test-driven development, verification.
- UI skills: tastemaker (palette, contrast and anti-slop scans), web-design-engineer, emil-design-eng (motion), plus the interface-review and better-* checklists.

## What I used it for

- **Design:**
  - I wrote the decisions up front: locking strategy, status codes, UI requirements.
  - The AI turned them and the brief into a design spec and a 15-task implementation plan (`docs/superpowers/`).
  - I reviewed and approved each one before any code was written.
- **Backend:** EF Core model and migration, the locking service, the expiry sweeper, validation and error middleware. Every rule was written test-first against real PostgreSQL (Testcontainers).
- **Frontend:** the API client, hooks (polling, countdown, student id) and the four screens, also test-first with Vitest and React Testing Library.
- **Docker:** Dockerfiles, compose profiles for tests and the second backend, and the smoke and race scripts.
- **UI review:** Playwright screenshots at 360px and 1280px with worst-case data, then fixes.

## Where the AI was wrong, and how it was caught

| What went wrong | How it was caught |
|---|---|
| The text extracted from the PDF brief had broken Bengali glyphs and duplicated lines. | Cross-checked against my English summary of the brief; the API contract matched. |
| The first spec ran tests in a container via `host.docker.internal` without `extra_hosts: host-gateway`, which fails on Linux. | Spec self-review, before any code. |
| It excluded macOS `._*` files from the C# build with `<Compile Remove>` in `Directory.Build.props`. That runs before the SDK adds its globs, so it did nothing. | A deliberate build with a garbage `._Junk.cs` failed. Fixed with `DefaultItemExcludes`. |
| Its xUnit fixture had two public constructors, which xUnit rejects. | Every schema test failed with a fixture error. |
| It used Postgres `now()` for the hold's expiry inside the locked transaction. `now()` is frozen at transaction start, so a request that waited for the lock would get a shorter hold. | Reasoning about lock waits while writing the concurrency code. Switched to `clock_timestamp()`. |
| It generated `package-lock.json` through a bind mount on my exFAT drive, and npm silently truncated it to 0 bytes. | The next install failed. The lockfile is now generated inside the container and streamed out. |
| nginx served `config.js` as 403 Forbidden, because the file's 0700 mode from my drive was copied into the image. | curl against the running stack. Fixed with `chmod` in the Dockerfile. |
| The first layout pinned the whole header. On a 360px phone it covered a quarter of the screen and hid the countdown during the cancel confirmation. | Screenshot review at 360px. Only the compact student bar is sticky now. |
| The 17-digit student id wrapped mid-number on small phones. | Same screenshot review. |
| It animated the seat bar's `width` on every poll (layout work) and used an ease-in curve. | tastemaker's `audit_motion.py`. Moved to `transform: scaleX`. |
| A countdown test recomputed its target time on every render, so it never counted down. | The test failed. The test was wrong, not the hook. |
| A fresh-context AI review of the whole branch found three gaps the tests missed. CORS only allowed `localhost:3000`, so opening the app as `127.0.0.1` showed a dead UI. The expiry sweeper could deadlock with an apply under load. A bare UUID returned 400 instead of 404. | A second reviewer (separate AI session) read the diff and probed the running API. Each issue got a failing test first, then a fix (`SKIP LOCKED`, any-origin CORS, GUID ids), plus a backend healthcheck. |
| Adding Swagger with `.Accepts<T>("application/json")` made `POST /classes` reject bodies without a JSON content type (415). | An existing test (`Create_NoContentType_400`) failed. The body is now documented without the constraint. |
| It added `Co-Authored-By` lines to commits. | I noticed and asked for them to be removed. History was rewritten before the first push. |
| The first load-test run reported success but had sent only about 1,370 of the 2,000 requests. The load generator had too few virtual users and silently dropped the rest. | I read the full k6 output, not just the pass/fail line. Fixed by provisioning enough virtual users and adding a threshold that fails the run if any iteration is dropped. |
| The Bangla strings were drafted by the AI and have not been checked by a native speaker. | Flagged in the README and in `frontend/src/i18n/dictionary.ts`. Needs review before submission. |
| The Bangla toggle's accessible name came from an `aria-label` that differed from the visible text. | A test looking the button up by its visible label failed. Removed the override so the visible text is the name. |

## Items added after the first submission candidate

- Swagger UI, reviewer fixes (strict UTF-8, owner-only `studentId`, millisecond server clock), health endpoints, request IDs, JSON logs.
- The admission slip, with the admission number from a database sequence.
- The Bangla / English switch for parent-facing screens.
- A k6 burst test, the architecture document with Mermaid diagrams, and a CI workflow.

## How I verified it

- **Backend:** 156 xUnit tests against real PostgreSQL, including:
  - 50 simultaneous applications for 5 seats;
  - parallel confirms;
  - confirm racing cancel;
  - expiry with no API calls.
- **Frontend:** 102 Vitest tests, including the countdown hitting 0, a skewed device clock, and checks that the English and Bangla dictionaries have identical keys.
- **Clean-clone check:** `docker compose down -v && docker compose up --build`, then `scripts/smoke.sh` walking every endpoint, then `down`/`up` to confirm data survives.
- **Two-process check:** `scripts/two-process-race.sh` across two API processes returned exactly 5 × 201 and 55 × 409.
