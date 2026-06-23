# Frontend Tracker (v1)

Status legend: ☐ Not started · ◐ In progress · ☑ Done · ⛔ Blocked

**Last updated:** 2026-06-23
**Master tracker:** `../TRACKER.md`

| ID | Milestone | Depends on | Status | Notes |
|----|-----------|-----------|--------|-------|
| FE-0 | Scaffold | — | ☑ | Vite + Tailwind v4 + Vitest + MSW; Plus Jakarta Sans + sky/green palette |
| FE-1 | Auth flow | BE-1 | ☑ | login/register, in-memory token, 401→refresh interceptor, route guard, sidebar layout |
| FE-2 | Companies | BE-2 | ☑ | list + search + create + delete |
| FE-3 | Applications Kanban | BE-3 | ☑ | @dnd-kit board, status-colored columns, optimistic status moves |
| FE-4 | Interviews | BE-4 | ☑ | list + create (application/type/interviewer) |
| FE-5 | Dashboard | BE-5 | ☑ | totals, by-status, upcoming interviews cards |
| FE-6 | Deploy | BE-6 | ☐ | static host + VITE_API_URL (separate session) |

## v1.5 — Application Details ☑ (2026-06-23, merged to `main`)
Right-side drawer to view/edit/create an application with all fields; company picker with **inline create**; the application's **interviews** listed with add/delete; Kanban cards show **company name + salary chip**; New-application + open-card buttons. Focus-trapped dialog. (Backend side: `company` included on application responses + unlink — in the BE repo.)

## v2 — Contacts (frontend slice) ☑ (2026-06-23, merged to `main`)
New **Contacts** sidebar page (searchable list, follow-up pill) + `ContactDrawer` (create/edit/delete, company picker w/ inline create, email/URL guards). New **Contacts section** in the application drawer (link existing / quick-create / unlink). `src/api/contacts.js`; query keys `['contacts']` / `['application', id]`. Spec in BE repo; plan: `docs/superpowers/plans/2026-06-23-contacts-frontend.md`.

## v2 — Post-Contacts UX + fixes ☑ (2026-06-23, merged to `main`)
- **Applications board:** removed the redundant quick-add; "Position title" input is now a **board search filter**; "New application" (drawer) is the single create path.
- **Application cards:** show the **applied date**; whole card body opens the detail drawer on click (guarded against drag / keyboard-synthesized clicks); ↗ button stays the keyboard affordance.
- **Auth resilience:** single-flight refresh (dedupes concurrent 401 refreshes); refresh only force-logs-out on a real `401` (a server outage/5xx no longer logs you out); **"Keep me logged in"** checkbox on Login (checked by default) → sends `rememberMe`.
- **Errors:** drawers surface the backend's per-field validation `details` (`src/lib/apiError.js`).

## Tests
62 passing across 13 suites (adds Analytics page tests — metrics, loading, empty, error, chart presence/absence — + the Analytics nav-link test). Production build verified.

## v2 — Analytics (frontend slice) ☑ (2026-06-23, merged to `main`)
New dedicated **Analytics** sidebar page (`/analytics`, placed right after Dashboard, `LineChart` icon) consuming `GET /api/analytics`. Four headline metric cards (total / interview / offer / rejection, rates as `%`) reusing the Dashboard card look, plus two **Recharts** charts: a horizontal **Pipeline** bar (count by status, per-status colors from DESIGN.md) and an **Applications over time** area chart (12 months). Loading / empty ("Add applications to see analytics") / error states. `src/api/analytics.js`; query key `['analytics']`; `recharts` added; jsdom `ResizeObserver` stub in `src/test/setup.js`. Spec in BE repo; plan: `docs/superpowers/plans/2026-06-23-analytics-frontend.md`. **Reviewed (read-only subagent) — Approved, no blocking;** non-blocking polish in `b556447` (gated the error banner on `!data` so loading/error/content stay mutually exclusive on a failed background refetch).

## In Flight
_v2 Contacts + Analytics merged to `main` (local only). **Deployment paused.** Next v2 slice: **Reminders** (V2-3) — start in a new session. See root `../TRACKER.md` for the full v2 module status._

## Notes / Blockers
- 2026-06-23 — FE-0…FE-5 implemented TDD on `feat/frontend-v1`. Design system in DESIGN.md.
- Caught during TDD: 401 interceptor was masking login credential errors with a failed token refresh — fixed to skip refresh on login/register/refresh 401s.
- Frontend dev server: http://localhost:5173 ; expects backend at http://localhost:4000.
