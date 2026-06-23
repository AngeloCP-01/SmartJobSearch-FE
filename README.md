# Smart Job Search CRM — Frontend (v1)

React single-page app for the Smart Job Search CRM: auth, companies, an applications **Kanban board** with drag-to-update status, interviews, and a dashboard.

## Stack

React + Vite · React Router · TanStack Query · Tailwind CSS v4 · @dnd-kit · lucide-react. Tests: Vitest + React Testing Library + MSW.

Design system (Plus Jakarta Sans, sky-blue + success-green SaaS palette, sidebar dashboard): see [`DESIGN.md`](./DESIGN.md).

## Prerequisites

- Node.js 20+
- The **backend** running at `http://localhost:4000` (see `SmartJobSearchCRM-BE/README.md` — `docker compose up -d` + `npm run dev`). The backend's CORS allows `http://localhost:5173`.

## Setup

```bash
npm install
cp .env.example .env      # VITE_API_URL=http://localhost:4000/api
npm run dev               # http://localhost:5173
```

## Tests

```bash
npm test
```

The Vitest suite mocks the backend at the network layer with **MSW**, so it runs without a live API. Coverage focuses on the auth flow, the 401→refresh interceptor, and the Kanban drop logic.

## Build

```bash
npm run build && npm run preview
```

## Structure

```
src/
  api/        client (axios + 401 refresh interceptor), authToken, per-resource calls
  auth/       AuthContext (session bootstrap), ProtectedRoute
  components/ Layout (sidebar/topbar), Field, Button
  pages/      Login, Register, Dashboard, Companies, Applications (Kanban), Interviews
  test/       MSW server, vitest setup, render helpers
```

## Auth model

The access token lives in memory and is sent as `Authorization: Bearer`. The refresh token is an httpOnly cookie (`withCredentials`); on a 401 the client calls `/auth/refresh` once and retries. On reload the session is restored via the cookie. Login/register/refresh 401s are treated as credential errors (no refresh retry).

## Status

v1 frontend (FE-0…FE-5) complete. Deployment (FE-6) is handled separately. See `docs/superpowers/plans/` for the implementation plan.
