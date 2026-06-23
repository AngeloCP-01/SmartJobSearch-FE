# Smart Job Search CRM — Frontend Design System (v1)

Derived from the ui-ux-pro-max recommendation, adapted from a landing-page bias to a **data-dense SaaS dashboard**. Light mode for v1 (tokens structured so dark mode can be added later).

## Typography

- **Font:** Plus Jakarta Sans (Google Fonts) — friendly, modern, made for SaaS dashboards. Weights 400/500/600/700.
- Headings 600–700, body 400, labels/nav 500. Base 16px, line-height 1.5.
- Tabular figures for numeric/data cells where it matters.

## Color palette (WCAG-checked)

| Token | Value | Tailwind ≈ | Use |
|-------|-------|-----------|-----|
| Primary | `#0369A1` | `sky-700` | primary buttons, active nav, links |
| Primary hover | `#075985` | `sky-800` | button/nav hover |
| Secondary/info | `#0EA5E9` | `sky-500` | accents, info |
| Accent/success | `#16A34A` | `green-600` | success, positive actions |
| App background | `#F0F9FF` | `sky-50` | page background |
| Surface | `#FFFFFF` | white | cards, sidebar, inputs |
| Text primary | `#0F172A` | `slate-900` | headings/body |
| Text muted | `#64748B` | `slate-500` | secondary text, labels |
| Border | `#E0F2FE`/`#BAE6FD` | `sky-100`/`sky-200` | dividers, card borders |
| Destructive | `#DC2626` | `red-600` | delete, errors |
| Focus ring | `#0EA5E9` | `sky-500` | `focus-visible` ring |

## Layout

- **Shell:** left **sidebar** on desktop (≥768px) — brand at top, nav links (Dashboard, Applications, Companies, Interviews), user + logout pinned at bottom. On mobile, the sidebar becomes a top app bar with the same links.
- Content area sits on `sky-50`; cards/surfaces are white with `rounded-xl border border-sky-100 shadow-sm`.
- Container max-width on wide screens; comfortable 4/8px spacing rhythm; generous whitespace.
- Active nav item highlighted (filled primary), not by color alone (weight + background).

## Components

- **Buttons:** primary = `bg-sky-700 hover:bg-sky-800 text-white`; subtle = `border` + `hover:bg-slate-50`; destructive = `text-red-600`. All: `rounded-lg`, `transition-colors` 150ms, `cursor-pointer`, visible `focus-visible:ring-2 ring-sky-500`, ≥40px tall.
- **Inputs:** white, `border border-slate-300 rounded-lg`, focus ring; visible `<label>` (not placeholder-only); errors below the field in red with `role="alert"`.
- **Cards:** `rounded-xl border border-sky-100 bg-white shadow-sm p-4/5`.
- **Icons:** `lucide-react` (consistent SVG set) — never emoji. ~18–20px, aligned to text.
- **Empty states:** friendly message + guidance, not a blank panel.

## Kanban (Applications)

- Horizontal scroll row of columns, one per status (Draft → Withdrawn). Each column: `bg-slate-50 rounded-xl`, a header pill colored per status, and a count.
- Cards: white `rounded-lg border shadow-sm`, `cursor-grab`, subtle lift on drag (`shadow-md`), drop target column tints `bg-sky-50`.
- Status hues: Draft `slate`, Applied `sky`, HR_Screening `indigo`, Technical_Interview `violet`, Final_Interview `amber`, Offer `green`, Accepted `emerald`, Rejected `red`, Withdrawn `slate`.

## Accessibility / quality bar

- Contrast ≥4.5:1 for text; color never the sole signal (icon/label too).
- Visible focus rings; full keyboard nav; `cursor-pointer` on clickables.
- Transitions 150–300ms; respect `prefers-reduced-motion`.
- Responsive at 375 / 768 / 1024 / 1440.

> This refines the **styling** of the components in `docs/superpowers/plans/2026-06-23-frontend-v1.md`; the component **structure/behavior and tests are unchanged** (tests assert text/roles, not classes).
