# Kickoff — Frontend adoption of `/api/v2` pagination (V3-29)

**Status:** not started. Backend (V3-28) is merged to `main` in `SmartJobSearchCRM-BE`
(merge `842afd2`) but **not deployed**.

**Read first:** `SmartJobSearchCRM-BE/docs/superpowers/specs/2026-08-13-list-pagination-design.md`
— it records *why* the backend is shaped this way. This document covers what the frontend
has to do about it.

---

## The one thing that will bite you

Do not "just point the list pages at v2."

`listApplications()` is called by **five** pages:

| File | Line | Purpose |
|---|---|---|
| `src/pages/Applications.jsx` | 277 | the actual list/board |
| `src/pages/Analysis.jsx` | 21 | "pick an application" dropdown |
| `src/pages/Interviews.jsx` | 27 | "pick an application" dropdown |
| `src/pages/TailorResume.jsx` | 42 | "pick an application" dropdown |
| `src/pages/CoverLetter.jsx` | 42 | "pick an application" dropdown |

**All five use the identical react-query key `['applications']`.** If the Applications page
writes a paginated subset into that key, the other four dropdowns show only page 1 — the
user cannot find an application that exists, assumes it is missing, and creates a duplicate.

That failure presents as **missing data, not as a pagination bug**, which is why it would
survive review. No current test guards it.

> **Rule:** "all rows" and "one page" must be different query keys. The regression test that
> matters is: *a dropdown page still receives every row.* Write that test first.

### Companies and contacts are a different (smaller) problem

An earlier read of this codebase claimed companies/contacts had the same collision. **They
do not** — their keys are already distinct:

| Caller | Key |
|---|---|
| `src/pages/Companies.jsx:14` | `['companies', search]` |
| `src/components/ApplicationDrawer.jsx:90`, `ContactDrawer.jsx:42` | `['companies']` |
| `src/pages/Contacts.jsx:19` | `['contacts', search]` |
| `src/components/ApplicationDrawer.jsx:104` | `['contacts']` |

The real risk here is different in shape: **the drawers call `listCompanies()` /
`listContacts()` with no argument.** If you change those functions to hit v2, the drawer
dropdowns truncate even though the keys never collide. Add a paginated variant; leave the
no-argument call returning everything.

---

## What the backend gives you

Base URL is set in `src/api/client.js:7` from `VITE_API_URL`, defaulting to
`http://localhost:4000/api/v1`. `/api/v2` is a **complete surface** — every non-list route
behaves identically to v1 — so a second axios instance pointed at `/api/v2` is enough. You
do **not** have to migrate everything at once.

**Offset endpoints** — `applications`, `analysis`, `companies`, `contacts`:

```
GET /api/v2/applications?page=1&pageSize=25&sort=createdAt&dir=desc
→ { items: [...], page, pageSize, total, totalPages }
```

**Cursor endpoint** — `activity` (append-only feed, deliberately not offset):

```
GET /api/v2/activity?pageSize=25&before=<cursor>
→ { items: [...], pageSize, nextCursor }      // no total / totalPages
```

### Page size

`10 | 25 | 50 | 100`, default `25`. Anything else is **400, not clamped** — so the selector
must offer exactly these four. Build the selector off the allowlist rather than hardcoding
it twice.

### Filters and sorts per endpoint

| Endpoint | Filters | Sort keys |
|---|---|---|
| `applications` | `status`, `companyId`, `search` (position + company name) | `position`, `company`, `status`, `applicationDate`, `createdAt` |
| `companies` | `search` (name) | `name`, `createdAt` |
| `contacts` | `search` (name, email), `companyId` | `name`, `createdAt` |
| `analysis` | — | `createdAt`, `atsScore`, `matchScore` |
| `activity` | `applicationId` | fixed (`createdAt desc, id desc`) |

An unknown `sort` key returns **400**. Note `applicationDate` — not `appliedDate`.

**Analysis cannot sort or search by `documentName` / `position`.** Those are projected out
of `report` JSON, not columns. Do not add UI affordances for them; the API will 400.

---

## Required behaviour (not optional polish)

1. **Separate query keys.** Paginated: `['applications', 'page', { page, pageSize, search, status, companyId, sort, dir }]`. All-rows stays `['applications']`. Same split for companies/contacts if you paginate those pages.
2. **Server-side search/filter/sort** for any paginated view. Filtering a single page client-side is silently wrong — it hides matching rows on other pages.
3. **Debounce search ~300ms.** There is no debounce today (`Applications.jsx:314`), so every keystroke would fire a request.
4. **`placeholderData: keepPreviousData`** so the table doesn't flash empty between pages.
5. **Reset to page 1** whenever any filter, search term, or page size changes. Otherwise a filter that shrinks the result set strands the user on an empty page 7.
6. **Invalidate both keys** on every mutation (create / status change / delete). Missing the all-rows key leaves the dropdowns stale.
7. **Pager must work at 375px** with ≥44px targets — see V3-27. Put the count ("1–25 of 137") somewhere it doesn't force a horizontal scroll.

## Explicitly out of scope

- **The Kanban board stays unpaginated.** It needs every row to populate its columns and to drag between them. Keep it on the all-rows call. This is a decision, not an oversight.
- **Retiring v1.** Both versions coexist until every call site has moved.
- **`documentName` / `position` as sortable columns** — needs a backend migration + backfill.

## Activity is already most of the way there

`src/pages/Activity.jsx:10` already uses `useInfiniteQuery` with `getNextPageParam: (last) => last.nextCursor`. Under v2 it needs the `limit` → `pageSize` rename and the allowlisted sizes. **Do not give it a numbered pager** — offset over a feed that grows at the top re-serves rows. `src/pages/Dashboard.jsx:78` also calls `fetchActivity()` for a recent-items preview; it wants a small `pageSize`, not paging.

## Suggested order

1. Regression test: a dropdown page still receives all rows (watch it pass, then keep it honest by pointing that page at a paginated key and watching it fail).
2. `src/api/client.js` — add a v2 instance. `src/api/applications.js` — add `listApplicationsPage(params)` alongside the untouched `listApplications()`.
3. Applications **List view** only — pager, page-size selector, server-side search/sort, debounce. Board untouched.
4. Companies, contacts, analysis pages.
5. Activity: `limit` → `pageSize`.

## Verification

- `npm test` (Vitest) — 303 passing as of V3-27.
- Check at **375px**: pager reachable, no horizontal pan (V3-27 fixed several of these; don't reintroduce one).
- Manually confirm each of the four dropdown pages still lists **every** application after the Applications page is paginated. This is the one that matters.

## Backend context worth knowing

- v1 responses are **byte-identical** to before and guarded by tests, so nothing breaks while you migrate incrementally.
- `total` is the **filtered** count, not the table count.
- `totalPages` is **0** for an empty result, not 1 — don't render "Page 1 of 1" over nothing.
- A page past the end returns `items: []` with a truthful `total` (a valid empty page, not a 404), so you can recover the pager state from it.
