# Frontend Tasks (v1)

Spec: `../SmartJobSearchCRM-BE/docs/superpowers/specs/2026-06-22-job-search-crm-v1-design.md`
Plan: `docs/superpowers/plans/2026-06-23-frontend-v1.md`
Design: `DESIGN.md`
Master coordination: `../TASKS.md`

> **Status (2026-06-23):** FE-0…FE-5 ✅ done — implemented TDD (15 tests across 8 suites, build verified) on `feat/frontend-v1`. Only **FE-6 (deploy)** remains.

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

## FE-6 — Deploy ☐
Static build hosted; point `VITE_API_URL` at the deployed API; backend `CORS_ORIGIN` = frontend origin.
