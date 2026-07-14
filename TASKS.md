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
> **Update (2026-07-13):** **V3-17 — Draft Tailored Résumé in Editor** done, reviewed (subagent-driven, 5 TDD tasks + a final Opus whole-branch review + a browser e2e), **merged & pushed** (`e6b2869`) — and **verified working in production**. A **"Draft in Editor"** button on the Tailor Résumé results opens the real résumé **verbatim** in the TipTap editor with a **click-to-locate suggestions panel** (highlights each suggestion's verbatim anchor via the Find/Replace extension); **no AI rewrite** (fabrication impossible; `add` items are read-only notes). New `TailoringPanel`, a shared `fetchEditorContent` helper (DRY'd from the Documents Open-in-Editor path), and `tailoring` via **ephemeral router nav state** (regression-safe). The e2e caught & fixed a stale-match locate bug (un-chained `setSearchTerm`+`findNext`, `f53e500`). BE adds a verbatim `anchor` to the tailor call. **FE 257 tests.** Spec/plan: BE `docs/superpowers/…2026-07-09-tailored-resume-in-editor…`. See `TRACKER.md` (V3-17 section).
>
> **Update (2026-07-09):** **V3-16 — Tailor Résumé** done, **merged** (`a3563d4`). New **`/tailor`** page: pick an application + résumé → `POST /api/analysis/tailor` → RAG-grounded emphasize/rephrase/remove/add suggestions as a checklist with **Copy all** + **Save to Documents** (a linked `.txt` notes doc). Suggestions-only (the no-fabrication backstop lives server-side); gated on AI availability, warns on a missing JD. **FE 246 tests.** Spec/plan: BE `docs/superpowers/…2026-07-09-tailor-resume-suggestions…`. See `TRACKER.md` (V3-16 section).
>
> **Update (2026-07-01):** **V3-9 — Editor v5: Image selection & free-resize** done, reviewed (subagent-driven + a final Opus whole-feature review), **merged & pushed to `main`** (frontend-only; BE carries spec/plan only). A floating image-options popup (TipTap `BubbleMenu`) + a real selection state (2px sky-blue ring + 8 resize handles) replace the old single corner handle; free-drag resize (corners aspect-locked, edges distortable, live W×H badge) replaces the old size presets, plus a "Reset size" button. Review caught a real drag-math defect (5 of 8 handles didn't track the cursor) — fixed via a transform-anchor approach; drag is manual/e2e verified. **200 tests.** FE `033de00` / BE `0e17688`. Spec/plan: BE `docs/superpowers/…2026-07-01-editor-image-selection-resize…`. See `TRACKER.md` (V3-9 section).
>
> **Update (2026-07-02):** **V3-10 — Editor v6: Image text-wrapping, drag positioning & free placement** done, reviewed (three subagent-driven sub-batches + Opus reviews per batch), **merged & pushed to `main`** (frontend-only). **Delivers the long-deferred v5 floating behind/in-front-of-text signature overlay.** The image node went inline with a `wrap` attribute (In line/Break/Wrap/In front of text/Behind text), a load-time migration (`imageContentMigration.js`) keeps legacy block-image docs opening under the new inline schema, the Align buttons were replaced by drag-to-reposition (drop caret, `posAtCoords`), and the popup modes were relabeled/reordered to In line · Over text · Behind text · Wrap around · Break. Reviews caught & fixed a NodeSelection-collapse bug, a shallow-migration gap (images in tables/lists), a click-not-drag (0,0) reposition bug, and a `repositionImageNode` throw-vs-null bug. **221 tests.** FE `4c18e17` / BE `213fcb9`. Spec/plan: BE `docs/superpowers/…2026-07-01-editor-image-text-wrapping…`, `…2026-07-01-editor-image-drag-positioning…`, `…2026-07-02-editor-image-free-placement-labels…`. See `TRACKER.md` (V3-10 section).
>
> **Update (2026-07-02):** **V3-11 — Cover Letter: Edit in Editor** done, **merged & pushed to `main`** (frontend-only, no backend changes — a cover-letter integration, not an editor version). An "Edit in Editor" button on the Cover Letter page converts the letter text to ProseMirror/TipTap JSON (new pure helper `textToProseMirrorDoc`), creates an `AuthoredDocument` (`type: CoverLetter`, linked to the application), and navigates to `/editor/:id`; the existing textarea/Copy/download/Save-to-Documents flows are untouched. Reuses the existing `POST /authored-documents`. Executed inline with TDD. **225 tests.** FE `d017350` / BE `fa8d02d`. Spec/plan: BE `docs/superpowers/…2026-07-02-cover-letter-edit-in-editor…`. See `TRACKER.md` (V3-11 section).
>
> **Update (2026-07-06):** **V3-13 — Documents → Editor: DOCX formatting fidelity + clean print** done, reviewed (subagent-driven, 9 TDD tasks + fixes, fresh implementer + spec/quality reviewer each, + a final Opus cross-repo review: **Ready to merge**). Closes the V3-12 deferred visual-fidelity gap: an uploaded DOCX now opens with **ruled section headings** (curated section-label list → `<h2 data-rule="true">`, never a job title), **tab-aligned two-column lines** (→ borderless `table.doc-columns`), a **centered contact block**, and **compact spacing** — plus a **multi-page print fix** (real per-page `@page` margins + break-control so headings/tables/rows don't split). FE adds two attribute-preserving extensions (`HeadingRule`, `TableColumns`), aligns the importer with the editor schema, and the CSS. Two defects caught in review/verification and fixed: a print `!important` cell-border overriding the borderless columns, and the `doc-columns` class being dropped on import (caught by a BE→FE pipeline probe). **FE 242 tests** (BE 217/1-skipped). Spec/plan: BE `docs/superpowers/…2026-07-03-docx-open-fidelity…`. See `TRACKER.md` (V3-13 section). *(V3-12 — Documents: Open in Editor — shipped 2026-07-03; see `TRACKER.md`.)*
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
