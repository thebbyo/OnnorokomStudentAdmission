# Style lock: School Admission portal

Established: 2026-11-10. Source: tastemaker cold start (no reference images). The palette was hand-tuned from `generate_palette.py --mood technical` output, then every pairing was verified with `check_contrast.py`. No stock imagery, photo fetching or icon fetching, by request.

## Design read

- **Surface:** an app shell plus transactional forms: class list (data view), hold screen (transaction), my applications (data view), admin form (form).
- **Audience:** parents on phones, under time pressure, competing for seats; plus one school admin.
- **Mode:** Operate.
- **Lane:** an official but friendly public-service portal. Calm, legible, obvious, not a SaaS landing page.
- **Dials:** variance 2, motion 2, density 5, art direction 2. Correctness beats looks (brief), so restraint is the point.
- **Anti-references:** gradient heroes, card grids with coloured left borders, emoji icons, glassmorphism, dark "dev tool" themes.

## Palette (light only)

| Token | Hex | Role |
|---|---|---|
| `--color-bg` | `#f5f7f8` | page background |
| `--color-surface` | `#ffffff` | cards, bars, inputs |
| `--color-text` | `#14212b` | body text: 16.38 on surface, 15.24 on bg |
| `--color-muted` | `#4a5a67` | secondary text: 7.12 on surface, 6.63 on bg |
| `--color-primary` | `#0f5b78` | primary buttons, links, confirmed seats: 7.53 on surface (button label white 7.53) |
| `--color-primary-hover` | `#0b4a62` | primary hover/pressed |
| `--color-primary-tint` | `#e3edf2` | selected/info backgrounds; primary text on it 6.34 |
| `--color-border` | `#d4dce1` | decorative hairlines only (1.39, never conveys state) |
| `--color-border-strong` | `#71818d` | input borders (UI-safe 4.02 on surface) |
| `--color-success` / `-bg` | `#1d6b40` / `#e7f3ec` | CONFIRMED: 5.71 text on bg, 6.50 on surface |
| `--color-urgent` / `-bg` | `#8a4500` / `#fff4e2` | under 60 s left, HELD badge: 6.58 |
| `--color-danger` / `-bg` | `#b42318` / `#fdeceb` | errors, EXPIRED, Full: 5.75 text on bg; white on danger 6.57 |
| `--color-held` | `#c27a0a` | held segment of the seat bar (graphical, 3.45 vs surface, UI-safe) |
| `--color-track` | `#e3e9ed` | available segment of the seat bar (decorative, always paired with numbers) |

**Dark mode:** not needed. Single light mode keeps one verified contract.

## Color contract

- **Text-safe (≥4.5):**
  - text, muted, primary, success, danger and urgent on surface or bg;
  - white on primary and on danger;
  - each semantic text colour on its own `-bg` tint.
- **UI-safe (≥3.0):** border-strong on surface; held on surface.
- **Decorative (<3.0):** border on surface or bg; track on surface. Never the only carrier of meaning.
- **Rule:** status is never colour alone. Every badge has text, and the urgent countdown adds a text line.

## Typography

- **Family:** Public Sans (variable, bundled via `@fontsource-variable/public-sans`), the typeface of government digital services. One family across weights: headings 650, body 400, labels 550.
- **Numbers:** `font-variant-numeric: tabular-nums` everywhere a number updates live (seat counts, countdown).
- **Scale (1.2 ratio, base 16px):** 13 / 14 / 16 / 19 / 23 / 28. The countdown is `clamp(3rem, 16vw, 4.5rem)`.

## Shape and spacing

- **Radius:** 4 (badges, inputs), 8 (buttons), 12 (cards). No pills except badges.
- **Elevation:** flat. 1px hairline borders separate regions, and there's one soft shadow on the sticky student bar only.
- **Spacing:** 4px base; tokens `--space-1..12` = 4, 8, 12, 16, 20, 24, 32, 40, 48.
  - Card padding is `--space-5` (20) on mobile and `--space-6` (24) at ≥640px, always ≤ the gap between cards.
- **Touch targets:** ≥ 44px. Content max width 960px with a 16px gutter. Works at 360px.

## Motion

- **Feel:** quick and restrained. `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`; 120 ms for presses, 200 ms for state changes, 300 ms for the seat-bar width.
- **Allowed:**
  - seat-bar segment widths;
  - the urgent countdown state (one slow pulse of the urgency outline, no colour flashing);
  - status transitions (badge fade).
- **Not allowed:** entrance animations on lists, page transitions, decorative motion.
- **Reduced motion:** all transitions and the pulse are disabled. State is still shown by text and colour.

## Do not

- No gradients, emoji, icon fonts or stock images.
- No colour-only status.
- No `transition: all`.
- No em dashes in UI copy.
