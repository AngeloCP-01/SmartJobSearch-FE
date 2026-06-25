# Frontend Tasks (v1)

Spec: `../SmartJobSearchCRM-BE/docs/superpowers/specs/2026-06-22-job-search-crm-v1-design.md`
Plan: `docs/superpowers/plans/2026-06-23-frontend-v1.md`
Design: `DESIGN.md`
Master coordination: `../TASKS.md`

> **Status (2026-06-23):** FE-0…FE-5 ✅ + **v1.5 application-details drawer** ✅ — implemented TDD (27 tests across 9 suites, build verified), reviewed, and **merged to `main`**. Only **FE-6 (deploy)** remains.
>
> **v1.5 (application details):** right-side drawer to view/edit/create an application (company w/ inline create, salary, dates, source, description, notes) + its interviews; cards show company + salary. Plan: `docs/superpowers/plans/2026-06-23-application-details.md`.
>
> **Update (2026-06-25):** details-drawer UX pass — **job-description read view** (faithful `whitespace-pre-wrap` rendering of pasted postings, Edit toggle, Expand-to-modal) and the drawer widened `max-w-md → max-w-xl`. Merged to `main` (`f56f3c0`). See `TRACKER.md` Notes for detail.

## FE-0 — Scaffold ☑
Vite + React, Tailwind v4, TanStack Query, axios client (`withCredentials`), Vitest + MSW.

## FE-1 — Auth flow ☑
Login/Register, in-memory access token, 401→`/auth/refresh` interceptor (single retry), route guard, responsive sidebar/topbar layout.

## FE-2 — Companies ☑
List + search + create + delete.

## FE-3 — Applications Kanban ☑
@dnd-kit board, one column per status, optimistic `PATCH /:id/status` on drop.

## FE-4 — Interviews ☑
List + create (application select, type, interviewer).

## FE-5 — Dashboard ☑
Summary cards: totals, by-status, upcoming interviews.

## FE-6 — Deploy ◐
Static build hosted; point `VITE_API_URL` at the deployed API; backend `CORS_ORIGIN` = frontend origin.

**Config landed (2026-06-25):** full-stack free-tier path — FE→Vercel, API→Render, DB→Neon, uploads→Supabase Storage. `vercel.json` (SPA rewrite) in this repo; backend gained an S3 storage driver, cross-site cookies, `render.yaml`, and a full walkthrough in `../SmartJobSearchCRM-BE/DEPLOY.md`. **Remaining:** provision the four free accounts + set env (DATABASE_URL, CORS_ORIGIN↔VITE_API_URL, S3_*), then deploy & smoke-test.
