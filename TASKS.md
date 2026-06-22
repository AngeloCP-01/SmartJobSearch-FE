# Frontend Tasks (v1)

Spec: `../SmartJobSearchCRM-BE/docs/superpowers/specs/2026-06-22-job-search-crm-v1-design.md`
Master coordination: `../TASKS.md`

> High-level scaffold. Each milestone (except FE-0) depends on the matching backend API being live. Granular tasks filled in from the implementation plan.

## FE-0 — Scaffold
- Vite + React + React Router
- TailwindCSS configured
- TanStack Query provider
- Axios client with `withCredentials`; base URL via env
- App shell / layout, route structure

## FE-1 — Auth flow *(needs BE-1)*
- Login + Register pages
- In-memory access token store
- Axios 401 → `/auth/refresh` interceptor (single retry), then redirect on failure
- Route guard for authenticated routes

## FE-2 — Companies *(needs BE-2)*
- List + search
- Create / edit / delete forms (TanStack Query mutations)

## FE-3 — Applications Kanban *(needs BE-3)*
- Board with a column per status
- @dnd-kit drag-and-drop
- Optimistic status update calling `PATCH /applications/:id/status`
- Application create/edit/detail

## FE-4 — Interviews *(needs BE-4)*
- List + CRUD, linked to an application

## FE-5 — Dashboard *(needs BE-5)*
- Summary cards: totals, by-status, upcoming interviews

## FE-6 — Deploy *(needs BE-6)*
- Static build hosted; point at deployed API; configure CORS/env
