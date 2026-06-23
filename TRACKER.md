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

## Tests
26 passing across 9 suites (adds ApplicationDrawer + board-integration tests). Production build verified.

## In Flight
_FE-0…FE-5 and v1.5 (application details) merged to `main` (local only). Only FE-6 (deploy) remains._

## Notes / Blockers
- 2026-06-23 — FE-0…FE-5 implemented TDD on `feat/frontend-v1`. Design system in DESIGN.md.
- Caught during TDD: 401 interceptor was masking login credential errors with a failed token refresh — fixed to skip refresh on login/register/refresh 401s.
- Frontend dev server: http://localhost:5173 ; expects backend at http://localhost:4000.
