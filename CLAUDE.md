# Design skills

Design skills are installed at project level in `.agents/skills/`. Claude Code loads them through symlinks in `.claude/skills/`. Sources are pinned in `skills-lock.json`.

## Installed skill sets

| Source | Skills | What it is for |
|---|---|---|
| `emilkowalski/skills` | 18 skills, e.g. `emil-design-eng`, `animate`, `choreograph`, `review-animations`, `improve-animations`, `animation-performance`, `apple-design`, `break-ui` | UI polish, animation and motion craft, gestures, React Native/Expo motion |
| `ConardLi/garden-skills` | 6 skills, e.g. `web-design-engineer`, `beautiful-article`, `motion-showreel`, `web-video-presentation` | Frontend web design builds, article pages, motion and video presentations |
| `elayadesign/ai-design-skills` | `landing-page-design`, `figma-designer` | Landing pages, Figma-oriented design |
| `jakubkrehel/skills` | 14 skills, e.g. `interface-review`, `better-ui`, `better-interface`, `better-typography`, `better-colors`, `better-layout`, `better-accessibility`, `better-writing` | Interface critique and polish across type, color, layout, a11y and copy |
| `codeswithroh/tastemaker` | `tastemaker` | Matching or locking a visual style, palettes, asset sourcing, anti-"AI slop" review of generated UI |
| `Owl-Listener/designer-skills` | 111 skills: UX laws, critique-*, research, design systems, tokens, IA, testing | Broad UX and design-process reference |

## Which skill to use

- **Landing pages:** `landing-page-design`
- **Matching a visual style, or reviewing generated UI:** `tastemaker`
- **Animation and motion:** `emil-design-eng`
- **Critique and polish:** `interface-review` and `better-ui`
- **Frontend design work:** `web-design-engineer`

## Rules

- Read the skill's `SKILL.md` before following it. Skills run with full agent permissions.
- `tastemaker` scripts need Python 3 and Pillow. `export_favicons.py` and `ideagram/scripts/export_png.py` also need `cairosvg` plus system cairo, which are not installed. The fetch scripts only call allowlisted hosts (Iconify, Openverse, Pixabay if a key is set). Some scripts write to `~/.tastemaker/` outside the repo.
