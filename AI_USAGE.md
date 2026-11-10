# AI usage

Running log, kept during development and condensed at the end.

## Tools

- **Claude Code** (Claude Opus 5.5) in VS Code: design brainstorming, spec, implementation plan, code, tests, Docker setup.
- Claude Code skills: superpowers (brainstorming, writing-plans, TDD, verification), and the design skills listed in CLAUDE.md for the UI.

## Where it was used

- Turned the brief and my pre-decided answers into a written design spec (`docs/superpowers/specs/`).

## Where the AI was wrong or needed correcting

| When | What happened | How it was caught |
|---|---|---|
| 2026-11-10 | Text extracted from the PDF brief came out with broken Bengali glyphs and duplicated lines, so the AI could not rely on it alone. | The AI cross-checked it against my own English prompt, and the API contract matched. |
| 2026-11-10 | The spec's first draft ran the tests in a container via `host.docker.internal` without `extra_hosts: host-gateway`, which would fail on Linux evaluator machines. | Caught in spec self-review before any code. |
| 2026-11-10 | The AI excluded macOS `._*` metadata files from the C# build with `<Compile Remove>` in `Directory.Build.props`. That runs before the SDK adds its file globs, so it did nothing. | A deliberate test that builds with a garbage `._Junk.cs` failed. Fixed with `DefaultItemExcludes`. |
| 2026-11-10 | The AI's first test fixture had two public constructors, which xUnit rejects for class fixtures. | All schema tests failed with a fixture error. Made the parameterised constructor protected. |
| 2026-11-10 | The AI computed `expiresAt` inside the hold transaction with Postgres `now()`, which is frozen at transaction start. A request that waited on the class lock would get a shorter hold. | Caught while reasoning about lock waits during Task 3. Switched to `clock_timestamp()` for lock-protected writes. |
| 2026-11-10 | The AI generated the npm lockfile through a bind mount on the exFAT drive; npm silently truncated it to 0 bytes. | The next install failed with ENOENT. Now the lockfile is streamed in and out of the container through stdin/stdout. |
| 2026-11-10 | The AI's first layout pinned the whole header (nav + student bar). On a 360px phone that covered ~25% of the screen and hid the countdown behind the cancel confirmation. | Found in the Playwright screenshot review at 360px. Now only the compact student bar is sticky. |
| 2026-11-10 | The AI allowed the 17-digit student ID to wrap mid-number at 360px. | Same screenshot review. Fixed with `white-space: nowrap`. |
| 2026-11-10 | The AI animated the seat bar's `width` (layout work on every poll) and used an ease-in curve on the skeleton. | Flagged by tastemaker's `audit_motion.py`. Moved to `transform: scaleX` with an ease-in-out curve. |
| 2026-11-10 | The AI wrote a countdown test that recomputed the target time on every render, so the countdown never moved. | The test failed. The fault was in the test, not the hook. |
| 2026-11-10 | The AI's nginx image served `config.js` with 403, because the 0700 file mode from the exFAT checkout was copied into the image. | Caught by curl-ing the running stack. Fixed with `chmod -R a+rX` in the Dockerfile. |
