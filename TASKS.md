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
>
> **Update (2026-06-29):** **V3-5 — In-app document editor ("Editor")** done, reviewed, **PR #1 merged to `main` (CI + Vercel green)**. TipTap v2 editor + toolbar, debounced autosave (Saving/Saved/Couldn't-save), list `/editor` + editor `/editor/:id`, print/PDF, sidebar nav; Vitest+MSW + a Playwright e2e smoke. **157 tests.** Spec/plan in the BE repo `docs/superpowers/`. See `TRACKER.md` (V3-5 section) for detail.
>
> **Update (2026-06-30):** **V3-6 — Editor v2: Typography & Page Layout** done, reviewed (6 TDD tasks + final Opus review), **merged to `main`** (frontend-only). Font family + size (custom `FontSize` ext), color/highlight, paper-style page canvas (Letter/A4 + margins) stored in the TipTap `content` JSON — no backend/migration. **170 tests.** Spec/plan: BE `docs/superpowers/…editor-v2-typography…`. See `TRACKER.md` (V3-6 section).
>
> **Update (2026-06-30):** **V3-7 — Editor v3: Tables & Find/Replace** done, reviewed (6 TDD tasks + final Opus review), **merged to `main`** (frontend-only). TipTap tables (insert/edit toolbar, resizable, print borders), task-list checkboxes, and a custom find & replace ProseMirror extension + panel (Ctrl/Cmd-F). Additive to the `content` JSON; no backend. **186 tests.** Plus post-merge polish (manual testing): installed `@tailwindcss/typography` (lists/headings now render — `prose` had been inert since v1), clickable+styled links, checklist alignment, and a line-spacing dropdown. Spec/plan: BE `docs/superpowers/…editor-v3-tables-findreplace…`. See `TRACKER.md` (V3-7 section).
>
> **Update (2026-06-30):** **V3-8 — Editor v4: Images** done, reviewed (6 TDD tasks + final Opus review across both repos), **merged to local `main` (NOT pushed)**. FE side: `@tiptap/extension-image` extended with width/align + a drag-resize NodeView; an Insert-image upload flow (via the shared axios client) + align controls. The backend (Image model + upload/public-serve) lives in the BE repo. **190 tests.** Review reverted an errant axios→fetch rewrite of the upload client (real cause: jsdom `File.text()` hang → test mocks `uploadImage`). Spec/plan: BE `docs/superpowers/…editor-v4-images…`. See `TRACKER.md` (V3-8 section).
>
> **Update (2026-07-01):** **V3-8 post-merge fixes** — image feature verified working (Playwright + user). Editor page now has a **Save button** + honest **"Unsaved changes"** status + **flush-on-leave**, and the image-save bug (a **stale React Query cache**) is fixed via `setQueryData` + list-invalidate on save. See `TRACKER.md`. **Next task:** comprehensive request logger (all API calls, success + error).
>
> **Update (2026-06-26):** post-deploy UX polish — Applications **List view + Status/Company filters**, Documents **upload dropzone**, and **app-wide loading feedback** (global top progress bar + `<Spinner>` + Button `loading`). All merged to `main`; **131 tests**. See `TRACKER.md` Notes.
>
> **Portfolio-readiness (2026-06-26):** one-click **demo login** (seeded account), public **landing page** (`/welcome`), polished **README + live screenshots + CI** (green badge), and **perf/a11y** (route code-splitting 761→284 KB, skip link, OG meta). **134 tests**. See `TRACKER.md` Notes.
>
> **AI cover-letter generator (2026-06-26):** new `/cover-letter` page → tailored letter from a JD + résumé (editable, copy, download as `<position> - <company>-cover-letter.txt`, or **Save to Documents** → a linked `.txt` CoverLetter doc). Reuses the OpenRouter model-fallback engine; needed widening the doc upload to accept `text/plain`. **138 tests**, verified live. See `TRACKER.md` Notes.
>
> **Job-posting auto-import (2026-06-26):** new-application drawer **"Auto-fill from a posting"** → AI parses pasted text/URL into position/company/salary/description (`POST /api/postings/parse`); errors shown inline. Also fixed the serial-suite test-DB flake (`connection_limit=1`). **140 tests**, verified live.
>
> **Work-mode field (2026-06-26):** applications gain a **Remote / Hybrid / On-site** field (`WorkMode` enum + migration), set in the drawer, extracted by auto-import, and shown as a chip on cards/list. **143 tests**, verified live.

## FE-0 — Scaffold ☑
Vite + React, Tailwind v4, TanStack Query, axios client (`withCredentials`), Vitest + MSW.

## FE-1 — Auth flow ☑
Login/Register, in-memory access token, 401→`/auth/refresh` interceptor (single retry), route guard, responsive sidebar/topbar layout.

## FE-2 — Companies ☑
List + search + create + delete.

## FE-3 — Applications Kanban + List ☑
@dnd-kit board, one column per status, optimistic `PATCH /:id/status` on drop.
**List view (2026-06-25):** `Board | List` toggle (persisted to `localStorage`); sortable table with an inline status quick-change `<select>` (same optimistic mutation as drag), click-row-to-open, and company-aware search.
**Filters (2026-06-25):** Status + Company dropdowns next to search, applied across both views (board narrows to the chosen status column); company options derived from loaded apps; a Clear link resets all filters.

## FE-4 — Interviews ☑
List + create (application select, type, interviewer).

## FE-5 — Dashboard ☑
Summary cards: totals, by-status, upcoming interviews.

## FE-6 — Deploy ☑
**Live 2026-06-25** (free tier): FE→**Vercel** `https://jobtrail-hq.vercel.app`, API→**Render** `https://smartjobsearch-api.onrender.com/api`, DB→**Neon**, uploads→**Supabase Storage**. `vercel.json` (`VITE_API_URL` → the Render `/api` base); backend `CORS_ORIGIN` = the bare Vercel origin (no path). Smoke-verified: register/login, cross-site refresh, upload/download, analysis. Full walkthrough + gotchas in `../SmartJobSearchCRM-BE/DEPLOY.md`.
