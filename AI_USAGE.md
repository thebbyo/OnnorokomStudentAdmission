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
