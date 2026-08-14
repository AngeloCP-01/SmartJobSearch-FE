# Frontend adoption of `/api/v2` pagination (V3-29) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move every paginated list surface in the frontend onto `/api/v2` — with a numbered pager, an allowlisted page-size selector, and server-side search/filter/sort — without truncating the four "pick an application" dropdowns or the two drawer dropdowns that share the same react-query keys.

**Architecture:** A second axios instance (`apiV2`) pointed at `/api/v2`, sharing the v1 client's auth request interceptor and its single-flight refresh promise. Every list module gains a `…Page(params)` function *alongside* its untouched all-rows function. "All rows" keeps its bare key (`['applications']`); "one page" gets `['<resource>', 'page', params]`, which the existing `invalidateQueries({ queryKey: ['<resource>'] })` calls already reach by prefix match. One shared `<Pager>` component and one `src/lib/pagination.js` serve all four offset lists.

**Tech Stack:** React 18, TanStack Query v5, axios, Vitest + MSW v2, Tailwind v4, lucide-react.

**Spec:**
- `SmartJobSearchCRM-FE/docs/KICKOFF-v2-pagination.md` (the frontend brief)
- `SmartJobSearchCRM-BE/docs/superpowers/specs/2026-08-13-list-pagination-design.md` (why the backend is shaped this way)

---

## Before Task 1: working tree and branch

The FE repo has **uncommitted changes on `main`** unrelated to this work (`DocumentEditor.jsx`, `Layout.jsx`, `Layout.test.jsx`, `index.css`, `Applications.jsx`, `Documents.jsx`, `Editor.jsx`, `EditorDocument.jsx`, `Interviews.jsx` — a nav/layout pass following commit `94c0348`). `Applications.jsx` is touched by both that work and this plan.

Commit or stash those first, then branch:

```bash
cd SmartJobSearchCRM-FE
git status --short          # confirm the tree is clean
git checkout -b feat/fe-v2-pagination
npm test                    # record the baseline count before changing anything
```

Do not start Task 1 with a dirty tree — Task 5 edits `Applications.jsx` heavily and a mixed diff is unreviewable.

## Global Constraints

Every task's requirements implicitly include these. Values are copied verbatim from the backend source, not from prose.

- **Page sizes are exactly `10 | 25 | 50 | 100`, default `25`.** An out-of-list value is **400, not clamped** (`src/shared/pagination.js`). Build every selector off the exported `PAGE_SIZES` array — never hardcode the four numbers twice.
- **Blank filter values must be omitted from the request, not sent empty.** v2 validates rather than coerces: `search` is `z.string().trim().min(1).optional()`, `companyId` is `z.string().uuid().optional()`, `status` is `z.enum(STATUSES).optional()`. `?search=` is a **400**, not "no filter". This is what `compactParams()` exists for.
- **Sort keys are allowlists; an unknown key is 400.**
  - `applications`: `position | company | status | applicationDate | createdAt` (note **`applicationDate`**, not `appliedDate`)
  - `companies`: `name | createdAt`
  - `contacts`: `name | createdAt`
  - `analysis`: `createdAt | atsScore | matchScore`
  - `activity`: fixed order, not sortable
  - `dir` is `asc | desc`, default `desc`.
- **`totalPages` is `0` when `total` is `0`**, not 1. Never render "Page 1 of 1" over nothing.
- **A page past the end returns `items: []` with a truthful `total`** — a valid empty page, not a 404. Recover the pager state from it.
- **`total` is the filtered count**, not the table count.
- **Offset envelope:** `{ items, page, pageSize, total, totalPages }`. **Cursor envelope (`activity` only):** `{ items, pageSize, nextCursor }` — no `total`, no `totalPages`.
- **All-rows keys and functions are untouchable.** `listApplications()`, `listCompanies()`, `listContacts()`, `fetchActivity()` keep hitting v1 and keep their bare keys `['applications']`, `['companies']`, `['contacts']`. Four dropdown pages and two drawers depend on them.
- **The Kanban board stays unpaginated.** It needs every row to populate its columns and to drag between them. This is a decision, not an oversight.
- **Salary is displayed but not sortable** in the List view (user decision, 2026-08-14): it is not in the server allowlist, and sorting the 25 rows on screen would report the page maximum as the overall maximum.
- **375px, ≥44px touch targets** (V3-27). No horizontal pan.
- **Backend v2 is merged (`842afd2`) but was not deployed as of 2026-08-13.** Do not deploy this frontend until `/api/v2/applications` answers on the Render production URL. Task 10 covers the check.

---

### Task 1: Regression guard — the four dropdown pages still receive every application

This is the test the whole plan exists to keep passing. It passes today; write it first so every later task runs against it.

**Files:**
- Create: `src/pages/applicationDropdowns.test.jsx`

**Interfaces:**
- Consumes: nothing (renders the four pages as they are today).
- Produces: nothing importable. It is a guard.

- [ ] **Step 1: Write the regression test**

Create `src/pages/applicationDropdowns.test.jsx`:

```jsx
import { http, HttpResponse } from 'msw';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { server, API } from '../test/server';
import Analysis from './Analysis';
import Interviews from './Interviews';
import TailorResume from './TailorResume';
import CoverLetter from './CoverLetter';

// Four pages use listApplications() only to fill a "pick an application"
// <select>. If a paginated subset ever lands in the ['applications'] key they
// share with the Applications page, these dropdowns silently show page 1 — the
// user cannot find an application that exists, assumes it is missing, and
// creates a duplicate. That presents as missing data, not as a pagination bug,
// which is why it needs its own guard rather than review attention.
const APPS = Array.from({ length: 30 }, (_, i) => ({
  id: `a${i + 1}`,
  position: `Role ${i + 1}`,
  status: 'Applied',
  company: null,
}));

vi.mock('../observability/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('../api/documents', async (importActual) => ({
  ...(await importActual()),
  createDocument: vi.fn(),
  linkDocument: vi.fn(),
}));
vi.mock('../api/authoredDocuments', () => ({ createAuthoredDocument: vi.fn() }));
vi.mock('../lib/openDocumentInEditor', () => ({ fetchEditorContent: vi.fn() }));

beforeEach(() => {
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json(APPS)),
    http.get(`${API}/documents`, () => HttpResponse.json([])),
    http.get(`${API}/interviews`, () => HttpResponse.json([])),
    http.get(`${API}/companies`, () => HttpResponse.json([])),
    http.get(`${API}/analysis`, () => HttpResponse.json([])),
    http.get(`${API}/analysis/config`, () => HttpResponse.json({ aiAvailable: false })),
  );
});

function renderPage(ui) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const PAGES = [
  ['Analysis', <Analysis key="analysis" />],
  ['Interviews', <Interviews key="interviews" />],
  ['TailorResume', <TailorResume key="tailor" />],
  ['CoverLetter', <CoverLetter key="cover" />],
];

test.each(PAGES)('%s lists every application in its dropdown, not just one page', async (_name, ui) => {
  renderPage(ui);
  // The first row proves the query resolved; the 30th proves it was not sliced
  // to a page. 30 > the default pageSize of 25 deliberately.
  expect(await screen.findByRole('option', { name: 'Role 1' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Role 30' })).toBeInTheDocument();
  expect(screen.getAllByRole('option', { name: /^Role \d+$/ })).toHaveLength(30);
});
```

- [ ] **Step 2: Run it and watch it pass**

```bash
npm test -- src/pages/applicationDropdowns.test.jsx
```

Expected: 4 passing.

- [ ] **Step 3: Prove the guard is honest**

A test that passes for the wrong reason is worse than no test. Temporarily truncate the handler so the guard has something to catch:

In the `beforeEach`, change the applications handler to `HttpResponse.json(APPS.slice(0, 25))` and re-run.

Expected: **all 4 fail** with "Unable to find role option with name Role 30".

Revert the `.slice(0, 25)` and re-run. Expected: 4 passing again. Do not commit the sliced version.

- [ ] **Step 4: Commit**

```bash
git add src/pages/applicationDropdowns.test.jsx
git commit -m "test: guard that the four application dropdowns receive every row"
```

---

### Task 2: A second axios instance for `/api/v2`

**Files:**
- Modify: `src/api/client.js` (whole-file rewrite, below)
- Modify: `src/api/client.test.js:1-8` (imports) and append two tests
- Modify: `src/test/server.js` (export `API_V2`, add a default v2 activity handler)

**Interfaces:**
- Produces:
  - `export default api` — the v1 instance, unchanged behaviour and unchanged import sites.
  - `export const apiV2` — axios instance on the `/api/v2` base, same auth interceptors, **sharing the same single-flight refresh promise** as `api`.
  - `export function toV2Base(base: string): string`
- Consumed by: Tasks 4, 6, 7, 8, 9 (`apiV2`) and `src/test/server.js` (`toV2Base`).

- [ ] **Step 1: Write the failing tests**

Append to `src/api/client.test.js`, and change its first import line to pull in the new exports:

```js
// line 3 becomes:
import api, { apiV2, toV2Base } from './client';
// line 2 becomes:
import { server, API, API_V2 } from '../test/server';
```

Then append:

```js
test('toV2Base rewrites the versioned base and the bare /api alias alike', () => {
  // VITE_API_URL is '/api/v1' in CI and prod but the bare '/api' alias in the
  // local .env, so v2 has to be derived by rewriting whichever suffix is there.
  expect(toV2Base('http://localhost:4000/api/v1')).toBe('http://localhost:4000/api/v2');
  expect(toV2Base('http://localhost:4000/api')).toBe('http://localhost:4000/api/v2');
  expect(toV2Base('https://smartjobsearch-api.onrender.com/api/')).toBe('https://smartjobsearch-api.onrender.com/api/v2');
  expect(toV2Base('http://localhost:4000/api/v2')).toBe('http://localhost:4000/api/v2');
});

test('the v2 client sends the bearer token and shares the v1 single-flight refresh', async () => {
  // Two instances with two refresh promises is the same rotation race the
  // single-flight guard exists to prevent — it must be shared, not duplicated.
  let refreshCount = 0;
  setAccessToken('expired');
  const ok = ({ request }) => (request.headers.get('authorization') === 'Bearer fresh'
    ? HttpResponse.json({ ok: true })
    : HttpResponse.json({ error: { message: 'x', code: 'UNAUTHORIZED' } }, { status: 401 }));
  server.use(
    http.get(`${API}/widget-a`, ok),
    http.get(`${API_V2}/widget-b`, ok),
    http.post(`${API}/auth/refresh`, () => { refreshCount += 1; return HttpResponse.json({ accessToken: 'fresh' }); }),
  );
  const [a, b] = await Promise.all([api.get('/widget-a'), apiV2.get('/widget-b')]);
  expect(a.data).toEqual({ ok: true });
  expect(b.data).toEqual({ ok: true });
  expect(refreshCount).toBe(1);
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- src/api/client.test.js
```

Expected: FAIL — `toV2Base is not a function` / `API_V2` undefined.

- [ ] **Step 3: Rewrite `src/api/client.js`**

Replace the whole file:

```js
import axios from 'axios';
import { getAccessToken, setAccessToken, emitUnauthorized } from './authToken';

// Canonical API base is the versioned /api/v1; the backend also serves the
// unversioned /api as a backward-compatible alias.
const V1_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';

// VITE_API_URL is '/api/v1' in CI and prod but the bare '/api' alias in the
// local .env, so the v2 base is derived by rewriting whichever suffix is
// present rather than by concatenation. Exported so the MSW test server
// resolves the identical base instead of keeping a second copy of this rule.
export function toV2Base(base) {
  return base.replace(/\/api(\/v\d+)?\/?$/, '/api/v2');
}

function createClient(baseURL) {
  const instance = axios.create({ baseURL, withCredentials: true });
  instance.interceptors.request.use((config) => {
    const token = getAccessToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
  return instance;
}

const api = createClient(V1_BASE);

// /api/v2 is a complete surface — every non-list route behaves exactly as v1 —
// so a second instance is enough and call sites migrate one at a time.
export const apiV2 = createClient(toV2Base(V1_BASE));

// Single-flight refresh: when several requests 401 at once, they must share ONE
// /auth/refresh call. Firing one per request races the backend's token rotation
// (the losers hit "token already rotated" and get logged out / 500'd). The
// promise is module-level rather than per-instance so a v1 and a v2 request
// that 401 together still share it.
let refreshPromise = null;
function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = api.post('/auth/refresh')
      .then(({ data }) => { setAccessToken(data.accessToken); return data.accessToken; })
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

function attachRefresh(instance) {
  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const original = error.config;
      const status = error.response?.status;
      // A 401 from these endpoints means "bad credentials / no session", not an
      // expired access token — refreshing would mask the real error.
      const noRefresh = ['/auth/login', '/auth/register', '/auth/refresh'];
      const skipRefresh = noRefresh.some((p) => original?.url?.includes(p));
      if (status === 401 && !skipRefresh && original && !original._retried) {
        original._retried = true;
        try {
          const accessToken = await refreshSession();
          original.headers.Authorization = `Bearer ${accessToken}`;
          return instance(original);
        } catch (refreshErr) {
          // Only a real 401 means the session is invalid/expired → log out. A
          // network error or 5xx (server down/restarting) must NOT nuke the
          // session — just fail the request so it can be retried once it's back.
          if (refreshErr.response?.status === 401) {
            setAccessToken(null);
            emitUnauthorized();
          }
          return Promise.reject(refreshErr);
        }
      }
      return Promise.reject(error);
    },
  );
}

attachRefresh(api);
attachRefresh(apiV2);

export default api;
```

- [ ] **Step 4: Teach the MSW server about the v2 base**

In `src/test/server.js`, add the import and export just below the existing `API` export, and add one default handler:

```js
import { toV2Base } from '../api/client';

// …existing `export const API = …` line stays as-is…

// Derived through the same helper the client uses, so the two can never drift.
export const API_V2 = toV2Base(API);
```

and inside the `handlers` array, directly after the existing `${API}/activity` entry:

```js
  http.get(`${API_V2}/activity`, () =>
    HttpResponse.json({ items: [], pageSize: 25, nextCursor: null })),
```

- [ ] **Step 5: Run the tests**

```bash
npm test -- src/api/client.test.js
```

Expected: PASS (8 tests — the 6 existing plus 2 new).

```bash
npm test
```

Expected: the full suite still passes. The v1 instance's behaviour is unchanged, so nothing else should move.

- [ ] **Step 6: Commit**

```bash
git add src/api/client.js src/api/client.test.js src/test/server.js
git commit -m "feat(api): add an /api/v2 axios instance sharing the v1 auth refresh"
```

---

### Task 3: Shared pagination primitives and the `<Pager>` component

**Files:**
- Create: `src/api/params.js`
- Create: `src/lib/pagination.js`
- Create: `src/lib/pagination.test.js`
- Create: `src/components/Pager.jsx`
- Create: `src/components/Pager.test.jsx`

**Interfaces:**
- Produces:
  - `src/api/params.js` → `export function compactParams(params: object): object`
  - `src/lib/pagination.js` → `PAGE_SIZES: number[]`, `DEFAULT_PAGE_SIZE: number`, `rangeLabel({ page, pageSize, total }): string`, `pageWindow(page, totalPages, span?): (number|null)[]`, `useDebouncedValue(value, delay?)`, `useClampedPage(page, totalPages, setPage)`
  - `src/components/Pager.jsx` → default export `<Pager page pageSize total totalPages onPageChange onPageSizeChange />`
- Consumed by: Tasks 4–9.

- [ ] **Step 1: Write the failing tests for the pure helpers**

Create `src/lib/pagination.test.js`:

```js
import { act, renderHook } from '@testing-library/react';
import { pageWindow, rangeLabel, useClampedPage, useDebouncedValue } from './pagination';
import { compactParams } from '../api/params';

test('rangeLabel reads as "first–last of total"', () => {
  expect(rangeLabel({ page: 1, pageSize: 25, total: 137 })).toBe('1–25 of 137');
  expect(rangeLabel({ page: 6, pageSize: 25, total: 137 })).toBe('126–137 of 137'); // partial last page
  expect(rangeLabel({ page: 1, pageSize: 25, total: 3 })).toBe('1–3 of 3');
});

test('rangeLabel says nothing numeric when there is nothing to count', () => {
  // "0–0 of 0" reads as a bug, and totalPages is 0 (not 1) for an empty result.
  expect(rangeLabel({ page: 1, pageSize: 25, total: 0 })).toBe('No results');
});

test('pageWindow keeps the first and last page and elides the runs between', () => {
  expect(pageWindow(1, 1)).toEqual([1]);
  expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
  expect(pageWindow(2, 5)).toEqual([1, 2, 3, null, 5]);
  expect(pageWindow(5, 10)).toEqual([1, null, 4, 5, 6, null, 10]);
  expect(pageWindow(10, 10)).toEqual([1, null, 9, 10]);
});

test('pageWindow renders nothing for an empty result', () => {
  expect(pageWindow(1, 0)).toEqual([]);
});

test('compactParams drops blanks so v2 validation is not tripped by an empty filter', () => {
  // v2 validates rather than coerces: search is min(1) after trim, companyId is
  // a uuid, status is an enum. `?search=` is a 400, not "no filter".
  expect(compactParams({ page: 1, search: '', status: undefined, companyId: null, sort: 'createdAt' }))
    .toEqual({ page: 1, sort: 'createdAt' });
  expect(compactParams({ page: 1, pageSize: 25 })).toEqual({ page: 1, pageSize: 25 });
});

describe('useDebouncedValue', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test('holds the previous value until the delay elapses', () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 300), { initialProps: { v: 'a' } });
    expect(result.current).toBe('a');
    rerender({ v: 'ab' });
    expect(result.current).toBe('a');
    act(() => vi.advanceTimersByTime(299));
    expect(result.current).toBe('a');
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe('ab');
  });

  test('a keystroke inside the window restarts it, so only the last value lands', () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 300), { initialProps: { v: 'a' } });
    rerender({ v: 'ab' });
    act(() => vi.advanceTimersByTime(200));
    rerender({ v: 'abc' });
    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe('a');
    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe('abc');
  });
});

describe('useClampedPage', () => {
  test('steps back to the last real page when the current one is past the end', () => {
    // Deleting the only row on page 4 leaves the client asking for a page the
    // API answers as valid-but-empty. Recover from the truthful totalPages.
    const setPage = vi.fn();
    renderHook(() => useClampedPage(4, 3, setPage));
    expect(setPage).toHaveBeenCalledWith(3);
  });

  test('does nothing while the page is in range', () => {
    const setPage = vi.fn();
    renderHook(() => useClampedPage(2, 3, setPage));
    expect(setPage).not.toHaveBeenCalled();
  });

  test('does nothing on an empty result, which has zero pages and no page to fall back to', () => {
    const setPage = vi.fn();
    renderHook(() => useClampedPage(1, 0, setPage));
    expect(setPage).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- src/lib/pagination.test.js
```

Expected: FAIL — cannot resolve `./pagination` / `../api/params`.

- [ ] **Step 3: Write `src/api/params.js`**

```js
// v2 validates query parameters rather than coercing them: `search` is
// z.string().trim().min(1).optional(), `companyId` is a uuid, `status` an enum.
// Axios serialises `{ search: '' }` as `?search=`, which is a 400 — not "no
// filter" — so blanks have to be dropped before the request, not after.
export function compactParams(params) {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined),
  );
}
```

- [ ] **Step 4: Write `src/lib/pagination.js`**

```js
import { useEffect, useState } from 'react';

// Mirrors the backend allowlist in SmartJobSearchCRM-BE/src/shared/pagination.js.
// An out-of-list value is rejected with 400, never clamped, so this array is a
// contract: build every size selector off it rather than writing the four
// numbers a second time in JSX.
export const PAGE_SIZES = [10, 25, 50, 100];
export const DEFAULT_PAGE_SIZE = 25;

// "1–25 of 137". An empty result gets words, not numbers: totalPages is 0 for
// an empty list (not 1), and "0–0 of 0" reads as a bug rather than as a state.
export function rangeLabel({ page, pageSize, total }) {
  if (!total) return 'No results';
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  return `${first}–${last} of ${total}`;
}

// A short window of page numbers that always includes the first and last, with
// null standing in for an elided run. Keeps the pager one row wide at 375px
// however many pages there are.
export function pageWindow(page, totalPages, span = 1) {
  if (totalPages <= 0) return [];
  const wanted = new Set([1, totalPages]);
  for (let p = page - span; p <= page + span; p += 1) {
    if (p >= 1 && p <= totalPages) wanted.add(p);
  }
  const out = [];
  let prev = 0;
  for (const p of [...wanted].sort((a, b) => a - b)) {
    if (prev && p - prev > 1) out.push(null);
    out.push(p);
    prev = p;
  }
  return out;
}

// Search boxes drive a server request per change now that filtering is
// server-side; without this, every keystroke is a round trip and — at 25 rows a
// page — a visible flicker. Lives here rather than in a generic util because
// paginated search is the only thing that needs it.
export function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// Deleting the last row on the last page leaves `page` past the end. v2 answers
// that with a valid empty page and a truthful totalPages rather than a 404, so
// step back to the last real page instead of leaving the user staring at
// nothing. totalPages === 0 means the list is genuinely empty — stay put.
export function useClampedPage(page, totalPages, setPage) {
  useEffect(() => {
    if (totalPages > 0 && page > totalPages) setPage(totalPages);
  }, [page, totalPages, setPage]);
}
```

- [ ] **Step 5: Run the helper tests**

```bash
npm test -- src/lib/pagination.test.js
```

Expected: PASS (10 tests).

- [ ] **Step 6: Write the failing Pager test**

Create `src/components/Pager.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Pager from './Pager';

const props = (over) => ({
  page: 1, pageSize: 25, total: 137, totalPages: 6,
  onPageChange: vi.fn(), onPageSizeChange: vi.fn(), ...over,
});

test('shows the range and offers exactly the allowlisted page sizes', () => {
  render(<Pager {...props()} />);
  expect(screen.getByText('1–25 of 137')).toBeInTheDocument();
  // Anything outside 10/25/50/100 is a 400 from v2, so the selector must not be
  // able to ask for one.
  expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['10', '25', '50', '100']);
});

test('renders nothing at all when there are no results', () => {
  const { container } = render(<Pager {...props({ total: 0, totalPages: 0 })} />);
  expect(container).toBeEmptyDOMElement();
});

test('marks the current page and disables Previous on the first page', () => {
  render(<Pager {...props()} />);
  expect(screen.getByRole('button', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('button', { name: /previous page/i })).toBeDisabled();
  expect(screen.getByRole('button', { name: /next page/i })).toBeEnabled();
});

test('disables Next on the last page', () => {
  render(<Pager {...props({ page: 6 })} />);
  expect(screen.getByRole('button', { name: /next page/i })).toBeDisabled();
});

test('Next and a numbered button report the page they want', async () => {
  const onPageChange = vi.fn();
  render(<Pager {...props({ page: 3, onPageChange })} />);
  await userEvent.click(screen.getByRole('button', { name: /next page/i }));
  expect(onPageChange).toHaveBeenCalledWith(4);
  await userEvent.click(screen.getByRole('button', { name: 'Page 6' }));
  expect(onPageChange).toHaveBeenCalledWith(6);
});

test('the size selector reports a number, not the string the DOM hands back', async () => {
  const onPageSizeChange = vi.fn();
  render(<Pager {...props({ onPageSizeChange })} />);
  await userEvent.selectOptions(screen.getByLabelText(/rows per page/i), '50');
  expect(onPageSizeChange).toHaveBeenCalledWith(50);
});
```

- [ ] **Step 7: Run to verify it fails**

```bash
npm test -- src/components/Pager.test.jsx
```

Expected: FAIL — cannot resolve `./Pager`.

- [ ] **Step 8: Write `src/components/Pager.jsx`**

```jsx
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PAGE_SIZES, pageWindow, rangeLabel } from '../lib/pagination';

// min-h-11 / min-w-11 is 44px — the V3-27 touch-target floor.
const btn = 'inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 cursor-pointer hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500';
const current = 'inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-sky-700 bg-sky-700 px-3 text-sm font-semibold text-white';

// Shared by every offset-paginated list. Stacks into two rows on phones — count
// and size selector above, page buttons below — so a long page run never forces
// a horizontal pan at 375px; one row from sm up.
export default function Pager({ page, pageSize, total, totalPages, onPageChange, onPageSizeChange }) {
  // totalPages is 0 (not 1) for an empty result. Rendering "Page 1 of 1" over
  // nothing is a lie, so render nothing.
  if (!total) return null;

  const pages = pageWindow(page, totalPages);
  const go = (p) => { if (p >= 1 && p <= totalPages && p !== page) onPageChange(p); };

  return (
    <nav aria-label="Pagination" className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center justify-between gap-3 sm:justify-start">
        <p className="text-sm text-slate-500" aria-live="polite">{rangeLabel({ page, pageSize, total })}</p>
        <label className="flex items-center gap-2 text-sm text-slate-500">
          <span className="sr-only sm:not-sr-only">Rows</span>
          <select
            aria-label="Rows per page"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="min-h-11 rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-700 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => go(page - 1)} className={btn}>
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        {pages.map((p, i) => (p === null ? (
          // eslint-disable-next-line react/no-array-index-key
          <span key={`gap-${i}`} aria-hidden="true" className="px-1 text-slate-400">…</span>
        ) : (
          <button
            key={p}
            type="button"
            aria-label={`Page ${p}`}
            aria-current={p === page ? 'page' : undefined}
            onClick={() => go(p)}
            className={p === page ? current : btn}
          >
            {p}
          </button>
        )))}
        <button type="button" aria-label="Next page" disabled={page >= totalPages} onClick={() => go(page + 1)} className={btn}>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
```

- [ ] **Step 9: Run the tests**

```bash
npm test -- src/components/Pager.test.jsx src/lib/pagination.test.js
```

Expected: PASS (16 tests).

- [ ] **Step 10: Commit**

```bash
git add src/api/params.js src/lib/pagination.js src/lib/pagination.test.js src/components/Pager.jsx src/components/Pager.test.jsx
git commit -m "feat(pagination): shared page-size allowlist, helpers, and Pager component"
```

---

### Task 4: `listApplicationsPage()` alongside the untouched `listApplications()`

**Files:**
- Modify: `src/api/applications.js:1-6`
- Create: `src/api/applications.test.js`

**Interfaces:**
- Consumes: `apiV2` (Task 2), `compactParams` (Task 3).
- Produces: `export async function listApplicationsPage(params?): Promise<{ items, page, pageSize, total, totalPages }>`

- [ ] **Step 1: Write the failing test**

Create `src/api/applications.test.js`:

```js
import { http, HttpResponse } from 'msw';
import { server, API, API_V2 } from '../test/server';
import { listApplications, listApplicationsPage } from './applications';

test('listApplications still hits v1 and returns the bare array', async () => {
  // The four dropdown pages and the Kanban board depend on this staying v1.
  server.use(http.get(`${API}/applications`, () => HttpResponse.json([{ id: 'a1' }])));
  await expect(listApplications()).resolves.toEqual([{ id: 'a1' }]);
});

test('listApplicationsPage hits v2 and returns the offset envelope', async () => {
  let seen = null;
  server.use(http.get(`${API_V2}/applications`, ({ request }) => {
    seen = Object.fromEntries(new URL(request.url).searchParams);
    return HttpResponse.json({ items: [{ id: 'a1' }], page: 2, pageSize: 25, total: 30, totalPages: 2 });
  }));
  const data = await listApplicationsPage({ page: 2, pageSize: 25, sort: 'applicationDate', dir: 'desc' });
  expect(seen).toEqual({ page: '2', pageSize: '25', sort: 'applicationDate', dir: 'desc' });
  expect(data.total).toBe(30);
});

test('listApplicationsPage omits blank filters rather than sending them empty', async () => {
  // `?search=` is a 400 from v2 (search is min(1) after trim), not "no filter".
  let seen = null;
  server.use(http.get(`${API_V2}/applications`, ({ request }) => {
    seen = Object.fromEntries(new URL(request.url).searchParams);
    return HttpResponse.json({ items: [], page: 1, pageSize: 25, total: 0, totalPages: 0 });
  }));
  await listApplicationsPage({ page: 1, pageSize: 25, search: '', status: '', companyId: '' });
  expect(seen).toEqual({ page: '1', pageSize: '25' });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- src/api/applications.test.js
```

Expected: FAIL — `listApplicationsPage is not a function`.

- [ ] **Step 3: Edit `src/api/applications.js`**

Replace lines 1–6 with:

```js
import api, { apiV2 } from './client';
import { compactParams } from './params';

// Every row, unpaginated, on v1. Feeds the Kanban board (which needs every row
// to populate its columns and drag between them) and the four "pick an
// application" dropdowns. Do NOT point this at v2 — see
// docs/KICKOFF-v2-pagination.md; a paginated subset here reads as missing data.
export async function listApplications() {
  const { data } = await api.get('/applications');
  return data;
}

// One page, on v2. Blank filters are dropped rather than sent empty: v2
// validates (`search` is min(1) after trim, `companyId` a uuid, `status` an
// enum), so `?search=` would be a 400.
export async function listApplicationsPage(params = {}) {
  const { data } = await apiV2.get('/applications', { params: compactParams(params) });
  return data;
}
```

Leave the rest of the file (lines 7–25 of the original: `getApplication`, `createApplication`, `updateStatus`, `updateApplication`, `deleteApplication`) exactly as it is.

- [ ] **Step 4: Run to verify it passes**

```bash
npm test -- src/api/applications.test.js
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/api/applications.js src/api/applications.test.js
git commit -m "feat(api): add listApplicationsPage on v2, leaving listApplications on v1"
```

---

### Task 5: Applications List view — server-side page, search, filter, sort

The largest task, and the one the regression guard in Task 1 exists for. The Kanban board is untouched.

**Files:**
- Modify: `src/pages/Applications.jsx` (sections detailed below)
- Modify: `src/pages/Applications.test.jsx` (update existing tests, add new ones)

**Interfaces:**
- Consumes: `listApplications`, `listApplicationsPage` (Task 4); `listCompanies` (existing); `Pager`, `DEFAULT_PAGE_SIZE`, `useDebouncedValue`, `useClampedPage` (Task 3).
- Produces: `export function patchAppStatus(data, id, status)` — a pure, shape-aware cache updater used by `moveMutationOptions`. Handles both the bare array (`['applications']`) and the offset envelope (`['applications','page',…]`).

- [ ] **Step 1: Write the failing tests**

In `src/pages/Applications.test.jsx`:

**(a)** Change the imports at the top:

```jsx
import { server, API, API_V2 } from '../test/server';
import Applications, { moveMutationOptions, patchAppStatus } from './Applications';
```

(`sortApps` is removed from the import — the server sorts now.)

**(b)** Add a `beforeEach` companies handler next to the existing `localStorage.clear()`, since the company filter now reads the full companies list:

```jsx
beforeEach(() => {
  localStorage.clear();
  server.use(http.get(`${API}/companies`, () => HttpResponse.json([])));
});
```

**(c)** Delete the `sortApps orders by the given key and direction without mutating input` test (lines 116–126). The helper it covers is going away; client-side sorting of one page would report the page maximum as the overall maximum.

**(d)** Replace the `move optimistically updates the cache and rolls back on error` test with a version that also covers the paginated shape:

```jsx
test('patchAppStatus updates both cache shapes and leaves anything else alone', () => {
  const rows = [{ id: 'a1', status: 'Applied' }, { id: 'a2', status: 'Draft' }];
  expect(patchAppStatus(rows, 'a1', 'Offer')[0].status).toBe('Offer');
  expect(patchAppStatus(rows, 'a1', 'Offer')[1].status).toBe('Draft');

  const envelope = { items: rows, page: 1, pageSize: 25, total: 2, totalPages: 1 };
  const patched = patchAppStatus(envelope, 'a2', 'Rejected');
  expect(patched.items[1].status).toBe('Rejected');
  expect(patched.total).toBe(2); // envelope metadata survives

  expect(patchAppStatus(undefined, 'a1', 'Offer')).toBeUndefined(); // unfetched query
});

test('move optimistically updates every applications cache and rolls them all back', async () => {
  // The List view reads ['applications','page',…] while the dropdowns read
  // ['applications']; an optimistic move has to reach whichever is mounted.
  const qc = new QueryClient();
  const params = { page: 1, pageSize: 25 };
  qc.setQueryData(['applications'], [{ id: 'a1', position: 'X', status: 'Applied' }]);
  qc.setQueryData(['applications', 'page', params], {
    items: [{ id: 'a1', position: 'X', status: 'Applied' }], page: 1, pageSize: 25, total: 1, totalPages: 1,
  });
  const opts = moveMutationOptions(qc);

  const ctx = await opts.onMutate({ id: 'a1', status: 'Offer' });
  expect(qc.getQueryData(['applications'])[0].status).toBe('Offer');
  expect(qc.getQueryData(['applications', 'page', params]).items[0].status).toBe('Offer');

  opts.onError(new Error('fail'), { id: 'a1', status: 'Offer' }, ctx);
  expect(qc.getQueryData(['applications'])[0].status).toBe('Applied');
  expect(qc.getQueryData(['applications', 'page', params]).items[0].status).toBe('Applied');
});
```

**(e)** Update the four existing List-view tests to serve v2. Each currently registers only `http.get(`${API}/applications`, …)`; add a v2 handler alongside. For `List view shows applications in a table…`, `changing status from the List view PATCHes /:id/status`, and `remembers the selected view across remounts`:

```jsx
const page = (items) => ({ items, page: 1, pageSize: 25, total: items.length, totalPages: items.length ? 1 : 0 });
```

Define that helper once near the top of the file and register `http.get(`${API_V2}/applications`, () => HttpResponse.json(page([...])))` in those tests with the same rows they already use.

**(f)** For `filters applications by company` (a board test), the options now come from `/companies`, so override the handler in that test:

```jsx
server.use(http.get(`${API}/companies`, () => HttpResponse.json([
  { id: 'c1', name: 'Acme' }, { id: 'c2', name: 'Globex' },
])));
```

**(g)** Append the new behaviour tests:

```jsx
test('the board makes no v2 request — it needs every row', async () => {
  let v2Calls = 0;
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([{ id: 'a1', position: 'Backend Eng', status: 'Applied' }])),
    http.get(`${API_V2}/applications`, () => { v2Calls += 1; return HttpResponse.json(page([])); }),
  );
  renderPage();
  await waitFor(() => expect(screen.getByText('Backend Eng')).toBeInTheDocument());
  expect(v2Calls).toBe(0);
});

test('the List view never writes a page into the all-rows ["applications"] cache', async () => {
  // The guard that matters: four dropdown pages read that key.
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([{ id: 'a1', position: 'Backend Eng', status: 'Applied' }])),
    http.get(`${API_V2}/applications`, () => HttpResponse.json(page([{ id: 'a1', position: 'Backend Eng', status: 'Applied' }]))),
  );
  render(<QueryClientProvider client={qc}><Applications /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByText('Backend Eng')).toBeInTheDocument());
  await userEvent.click(screen.getByRole('button', { name: /^list$/i }));
  await waitFor(() => expect(screen.getByLabelText('Status for Backend Eng')).toBeInTheDocument());
  const allRows = qc.getQueryData(['applications']);
  expect(Array.isArray(allRows)).toBe(true); // still the v1 array, not an envelope
});

test('the List view asks for page 1 at the default size and shows the count', async () => {
  let seen = null;
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([])),
    http.get(`${API_V2}/applications`, ({ request }) => {
      seen = Object.fromEntries(new URL(request.url).searchParams);
      return HttpResponse.json({
        items: [{ id: 'a1', position: 'Backend Eng', status: 'Applied' }],
        page: 1, pageSize: 25, total: 137, totalPages: 6,
      });
    }),
  );
  localStorage.setItem('applicationsView', 'list');
  renderPage();
  await waitFor(() => expect(screen.getByText('1–25 of 137')).toBeInTheDocument());
  expect(seen).toMatchObject({ page: '1', pageSize: '25', sort: 'applicationDate', dir: 'desc' });
});

test('clicking Next asks the server for page 2', async () => {
  const seen = [];
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([])),
    http.get(`${API_V2}/applications`, ({ request }) => {
      const p = Number(new URL(request.url).searchParams.get('page'));
      seen.push(p);
      return HttpResponse.json({ items: [{ id: `a${p}`, position: `Row ${p}`, status: 'Applied' }], page: p, pageSize: 25, total: 137, totalPages: 6 });
    }),
  );
  localStorage.setItem('applicationsView', 'list');
  renderPage();
  await screen.findByText('Row 1');
  await userEvent.click(screen.getByRole('button', { name: /next page/i }));
  await waitFor(() => expect(screen.getByText('Row 2')).toBeInTheDocument());
  expect(seen).toContain(2);
});

test('changing the page size sends an allowlisted value and returns to page 1', async () => {
  const seen = [];
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([])),
    http.get(`${API_V2}/applications`, ({ request }) => {
      const q = new URL(request.url).searchParams;
      seen.push({ page: q.get('page'), pageSize: q.get('pageSize') });
      return HttpResponse.json({ items: [{ id: 'a1', position: 'Backend Eng', status: 'Applied' }], page: Number(q.get('page')), pageSize: Number(q.get('pageSize')), total: 137, totalPages: 6 });
    }),
  );
  localStorage.setItem('applicationsView', 'list');
  renderPage();
  await screen.findByText('Backend Eng');
  await userEvent.click(screen.getByRole('button', { name: /next page/i }));
  await waitFor(() => expect(seen.at(-1).page).toBe('2'));
  await userEvent.selectOptions(screen.getByLabelText(/rows per page/i), '50');
  // A bigger page renumbers everything, so page 2 is meaningless — go back to 1.
  await waitFor(() => expect(seen.at(-1)).toEqual({ page: '1', pageSize: '50' }));
});

test('search is debounced into one request and filtered by the server', async () => {
  const terms = [];
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([])),
    http.get(`${API_V2}/applications`, ({ request }) => {
      terms.push(new URL(request.url).searchParams.get('search'));
      return HttpResponse.json(page([{ id: 'a1', position: 'Backend Eng', status: 'Applied' }]));
    }),
  );
  localStorage.setItem('applicationsView', 'list');
  renderPage();
  await screen.findByText('Backend Eng');
  await userEvent.type(screen.getByPlaceholderText(/search applications/i), 'kafka');
  await waitFor(() => expect(terms).toContain('kafka'));
  // Five keystrokes, one request: no intermediate 'k','ka','kaf','kafk'.
  expect(terms.filter(Boolean)).toEqual(['kafka']);
});

test('a status filter resets the pager back to page 1', async () => {
  const seen = [];
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([])),
    http.get(`${API_V2}/applications`, ({ request }) => {
      const q = new URL(request.url).searchParams;
      seen.push({ page: q.get('page'), status: q.get('status') });
      return HttpResponse.json({ items: [{ id: 'a1', position: 'Backend Eng', status: 'Applied' }], page: Number(q.get('page')), pageSize: 25, total: 137, totalPages: 6 });
    }),
  );
  localStorage.setItem('applicationsView', 'list');
  renderPage();
  await screen.findByText('Backend Eng');
  await userEvent.click(screen.getByRole('button', { name: /next page/i }));
  await waitFor(() => expect(seen.at(-1).page).toBe('2'));
  await userEvent.selectOptions(screen.getByLabelText(/filter by status/i), 'Offer');
  // Otherwise a filter that shrinks the set strands the user on an empty page 7.
  await waitFor(() => expect(seen.at(-1)).toEqual({ page: '1', status: 'Offer' }));
});

test('Salary is shown but is not a sort control', async () => {
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([])),
    http.get(`${API_V2}/applications`, () => HttpResponse.json(page([
      { id: 'a1', position: 'Backend Eng', status: 'Applied', salaryMin: 90000, salaryMax: 110000 },
    ]))),
  );
  localStorage.setItem('applicationsView', 'list');
  renderPage();
  await screen.findByText(/90k/);
  // v2 does not accept sort=salary (400), and sorting one page would report the
  // page maximum as the overall maximum.
  expect(screen.getByRole('columnheader', { name: /salary/i })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /sort by salary/i })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /sort by position/i })).toBeInTheDocument();
});

test('sorting by a column asks the server, not the client', async () => {
  let seen = null;
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([])),
    http.get(`${API_V2}/applications`, ({ request }) => {
      const q = new URL(request.url).searchParams;
      seen = { sort: q.get('sort'), dir: q.get('dir') };
      return HttpResponse.json(page([{ id: 'a1', position: 'Backend Eng', status: 'Applied' }]));
    }),
  );
  localStorage.setItem('applicationsView', 'list');
  renderPage();
  await screen.findByText('Backend Eng');
  await userEvent.click(screen.getByRole('button', { name: /sort by position/i }));
  await waitFor(() => expect(seen).toEqual({ sort: 'position', dir: 'asc' }));
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- src/pages/Applications.test.jsx
```

Expected: FAIL — `patchAppStatus` is not exported; the new tests get unhandled-request errors for `${API_V2}/applications`.

- [ ] **Step 3: Edit `src/pages/Applications.jsx` — imports**

Replace lines 1–13 with:

```jsx
import { useEffect, useRef, useState } from 'react';
import {
  DndContext, useDraggable, useDroppable,
  PointerSensor, KeyboardSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Plus, AlertCircle, Maximize2, Search, LayoutGrid, List, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { listApplications, listApplicationsPage, updateStatus } from '../api/applications';
import { listCompanies } from '../api/companies';
import Button from '../components/Button';
import ApplicationDrawer from '../components/ApplicationDrawer';
import Pager from '../components/Pager';
import Spinner from '../components/Spinner';
import { DEFAULT_PAGE_SIZE, useClampedPage, useDebouncedValue } from '../lib/pagination';
import { STATUSES } from '../lib/applicationStatus';
import { formatSalaryRange } from '../lib/salary';
```

- [ ] **Step 4: Replace `moveMutationOptions` (lines 51–68) with the shape-aware version**

```jsx
// The same application can sit in two caches at once: the bare ['applications']
// array the board and the four dropdowns read, and the ['applications','page',…]
// envelope the List view reads. An optimistic move has to patch whichever is
// mounted, so the updater is shape-aware rather than array-only.
export function patchAppStatus(data, id, status) {
  const move = (rows) => rows.map((a) => (a.id === id ? { ...a, status } : a));
  if (Array.isArray(data)) return move(data);
  if (data && Array.isArray(data.items)) return { ...data, items: move(data.items) };
  return data; // unfetched or an unexpected shape — leave it alone
}

// Optimistic-move mutation config, extracted so the cache logic (the interesting
// part) is unit-testable independently of pointer-based drag events.
export function moveMutationOptions(qc) {
  return {
    mutationFn: ({ id, status }) => updateStatus(id, status),
    onMutate: async ({ id, status }) => {
      // ['applications'] is a prefix, so this reaches the paginated key too.
      await qc.cancelQueries({ queryKey: ['applications'] });
      const prev = qc.getQueriesData({ queryKey: ['applications'] });
      qc.setQueriesData({ queryKey: ['applications'] }, (old) => patchAppStatus(old, id, status));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      for (const [key, data] of ctx?.prev ?? []) qc.setQueryData(key, data);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['applications'] });
      qc.invalidateQueries({ queryKey: ['activity'] });
    },
  };
}
```

- [ ] **Step 5: Delete the client-side sort and mark Salary unsortable (lines 162–187)**

Delete the `SORTS` object and the `sortApps` function entirely. Replace the `COLUMNS` array with:

```jsx
// `sortable` mirrors the server allowlist — v2 400s on anything else. Salary is
// displayed but not sortable: it is not a sort key, and sorting the 25 rows on
// screen would report the page maximum as the overall maximum.
const COLUMNS = [
  { key: 'position', label: 'Position', sortable: true },
  { key: 'company', label: 'Company', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'salary', label: 'Salary', sortable: false },
  { key: 'applicationDate', label: 'Applied', sortable: true },
];
```

Keep the `const dash = …` line.

- [ ] **Step 6: Update `ListView` (lines 189–262)**

Change the function signature line and the two lines under it from:

```jsx
function ListView({ apps, sort, onSort, onOpen, onStatusChange }) {
  const rows = sortApps(apps, sort);
```

to:

```jsx
function ListView({ rows, sort, onSort, onOpen, onStatusChange }) {
```

(The server returns the rows already sorted.) Then replace the `<th>` body inside `COLUMNS.map` with:

```jsx
            {COLUMNS.map((c) => {
              const active = c.sortable && sort.key === c.key;
              const SortIcon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
              return (
                <th key={c.key} scope="col" className="px-4 py-3 font-semibold">
                  {c.sortable ? (
                    <button
                      type="button"
                      onClick={() => onSort(c.key)}
                      aria-label={`Sort by ${c.label}`}
                      className="inline-flex items-center gap-1 cursor-pointer hover:text-slate-700"
                    >
                      {c.label}
                      <SortIcon size={12} aria-hidden="true" className={active ? '' : 'text-slate-300'} />
                    </button>
                  ) : c.label}
                </th>
              );
            })}
```

The `<tbody>` is unchanged.

- [ ] **Step 7: Rewrite the `Applications()` component body (lines 264–307, up to but not including `return (`)**

```jsx
export default function Applications() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [view, setView] = useState(() => localStorage.getItem('applicationsView') || 'kanban');
  const [sort, setSort] = useState({ key: 'applicationDate', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [drawer, setDrawer] = useState({ open: false, application: null });
  const openDrawer = (application) => setDrawer({ open: true, application });
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const isList = view === 'list';
  // The board filters an already-loaded array, so its search is instant. Only
  // the List view's search costs a request, so only it is debounced.
  const term = useDebouncedValue(search, 300).trim();
  const boardTerm = search.trim().toLowerCase();

  // The board needs every row: one column per status, and dragging between
  // them. It stays on the unpaginated v1 call under the shared ['applications']
  // key — the same key the four dropdown pages read.
  const board = useQuery({ queryKey: ['applications'], queryFn: listApplications, enabled: !isList });

  // "One page" is a separate key from "all rows" on purpose. Writing a subset
  // into ['applications'] would truncate the Analysis / Interviews /
  // TailorResume / CoverLetter dropdowns, and present as missing data.
  const pageParams = {
    page, pageSize, sort: sort.key, dir: sort.dir, search: term, status: statusFilter, companyId: companyFilter,
  };
  const list = useQuery({
    queryKey: ['applications', 'page', pageParams],
    queryFn: () => listApplicationsPage(pageParams),
    enabled: isList,
    placeholderData: keepPreviousData, // no empty flash between pages
  });

  // Filter options come from the full companies list, not from the rows on
  // screen: a page only knows its own 25 companies, so deriving from it would
  // hide the company the user is looking for. The trade is a few companies with
  // no applications in the dropdown; the alternative is an unreachable filter.
  // Shares the drawers' ['companies'] cache, so it is usually already warm.
  const { data: allCompanies = [] } = useQuery({ queryKey: ['companies'], queryFn: () => listCompanies() });
  const companyOptions = [...allCompanies].sort((x, y) => x.name.localeCompare(y.name));

  useEffect(() => { localStorage.setItem('applicationsView', view); }, [view]);

  // Anything that reshapes the result set invalidates the page number —
  // otherwise a filter that shrinks the set strands the user on an empty page 7.
  useEffect(() => { setPage(1); }, [term, statusFilter, companyFilter, pageSize, sort.key, sort.dir]);
  useClampedPage(page, list.data?.totalPages ?? 0, setPage);

  const apps = board.data ?? [];
  const hasFilters = Boolean(search.trim() || statusFilter || companyFilter);
  const visible = apps.filter((a) => {
    if (statusFilter && a.status !== statusFilter) return false;
    if (companyFilter && a.company?.id !== companyFilter) return false;
    if (boardTerm && !(a.position.toLowerCase().includes(boardTerm) || (a.company?.name || '').toLowerCase().includes(boardTerm))) return false;
    return true;
  });
  const shownStatuses = statusFilter ? [statusFilter] : STATUSES;
  const clearFilters = () => { setSearch(''); setStatusFilter(''); setCompanyFilter(''); };

  const rows = list.data?.items ?? [];
  const total = list.data?.total ?? 0;
  const totalPages = list.data?.totalPages ?? 0;
  const isLoading = isList ? list.isLoading : board.isLoading;
  const nothingYet = isList ? total === 0 && !hasFilters : apps.length === 0;
  const nothingMatched = isList ? total === 0 && hasFilters : apps.length > 0 && visible.length === 0;

  const move = useMutation(moveMutationOptions(qc));
  const onStatusChange = (id, status) => move.mutate({ id, status });
  const onSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  function onDragEnd(event) {
    applyDrop(
      { activeId: event.active?.id, overId: event.over?.id },
      (id, status) => move.mutate({ id, status }),
    );
  }
```

- [ ] **Step 8: Update the render block (the old lines 365–389)**

Replace the `{isLoading ? (…) : (…)}` block with:

```jsx
      {isLoading ? (
        <Spinner center />
      ) : (
        <>
          {nothingYet && (
            <p className="mb-3 text-sm text-slate-500">
              No applications yet — click <span className="font-medium">New application</span> to add your first one, then drag it across the board as you progress.
            </p>
          )}
          {nothingMatched && (
            <p className="mb-3 text-sm text-slate-500">No applications match your filters.</p>
          )}
          {isList ? (
            <>
              <ListView rows={rows} sort={sort} onSort={onSort} onOpen={openDrawer} onStatusChange={onStatusChange} />
              <Pager
                page={page}
                pageSize={pageSize}
                total={total}
                totalPages={totalPages}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </>
          ) : (
            <DndContext sensors={sensors} onDragEnd={onDragEnd}>
              <div className="flex gap-3 overflow-x-auto pb-4">
                {shownStatuses.map((s) => (
                  <Column key={s} status={s} apps={visible.filter((a) => a.status === s)} onOpen={openDrawer} />
                ))}
              </div>
            </DndContext>
          )}
        </>
      )}
```

Everything above (the header, search input, filter selects, `ViewToggle`, `New application` button, the `move.isError` alert) and the trailing `<ApplicationDrawer …>` stay exactly as they are.

- [ ] **Step 9: Run the tests**

```bash
npm test -- src/pages/Applications.test.jsx src/pages/applicationDropdowns.test.jsx
```

Expected: PASS. The dropdown guard from Task 1 must still be green — that is the point of this task.

- [ ] **Step 10: Run the whole suite**

```bash
npm test
```

Expected: PASS. `ApplicationDrawer` already invalidates `['applications']`, which prefix-matches the new paginated key, so no drawer change is needed.

- [ ] **Step 11: Commit**

```bash
git add src/pages/Applications.jsx src/pages/Applications.test.jsx
git commit -m "feat(applications): paginate the List view on v2, board stays unpaginated"
```

---

### Task 6: Companies page

**Files:**
- Modify: `src/api/companies.js:1-6`
- Modify: `src/pages/Companies.jsx:1-25` and the render block
- Modify: `src/pages/Companies.test.jsx`

**Interfaces:**
- Consumes: `apiV2`, `compactParams`, `Pager`, `DEFAULT_PAGE_SIZE`, `useDebouncedValue`, `useClampedPage`.
- Produces: `export async function listCompaniesPage(params?): Promise<{ items, page, pageSize, total, totalPages }>`

Sort stays `createdAt desc` — the same order the page shows today — and there is no sort UI: the list is a plain `<ul>` with no column headers to hang one on. Adding alphabetical sorting is a separate change, not a side effect of pagination.

- [ ] **Step 1: Write the failing tests**

In `src/pages/Companies.test.jsx`, change the import line to `import { server, API, API_V2 } from '../test/server';` and rewrite the two existing tests to serve v2, then add three:

```jsx
const page = (items, over = {}) => ({
  items, page: 1, pageSize: 25, total: items.length, totalPages: items.length ? 1 : 0, ...over,
});

test('lists companies from the API', async () => {
  server.use(http.get(`${API_V2}/companies`, () => HttpResponse.json(page([
    { id: '1', name: 'Acme', industry: 'Tech' },
  ]))));
  renderPage();
  await waitFor(() => expect(screen.getByText('Acme')).toBeInTheDocument());
});

test('creating a company refetches the page', async () => {
  const items = [];
  server.use(
    http.get(`${API_V2}/companies`, () => HttpResponse.json(page(items))),
    http.post(`${API_V2}/companies`, async ({ request }) => {
      const body = await request.json();
      const created = { id: '9', ...body };
      items.push(created);
      return HttpResponse.json(created, { status: 201 });
    }),
    // createCompany still goes through the v1 client; v2 is a complete surface
    // so either would work, but the write path is untouched by this plan.
    http.post(`${API}/companies`, async ({ request }) => {
      const body = await request.json();
      const created = { id: '9', ...body };
      items.push(created);
      return HttpResponse.json(created, { status: 201 });
    }),
  );
  renderPage();
  await userEvent.type(screen.getByPlaceholderText(/company name/i), 'Globex');
  await userEvent.click(screen.getByRole('button', { name: /add company/i }));
  await waitFor(() => expect(screen.getByText('Globex')).toBeInTheDocument());
});

test('asks for page 1 at the default size and shows the count', async () => {
  let seen = null;
  server.use(http.get(`${API_V2}/companies`, ({ request }) => {
    seen = Object.fromEntries(new URL(request.url).searchParams);
    return HttpResponse.json({ items: [{ id: '1', name: 'Acme' }], page: 1, pageSize: 25, total: 60, totalPages: 3 });
  }));
  renderPage();
  await waitFor(() => expect(screen.getByText('1–25 of 60')).toBeInTheDocument());
  expect(seen).toEqual({ page: '1', pageSize: '25', sort: 'createdAt', dir: 'desc' });
});

test('search is debounced, sent to the server, and resets the page', async () => {
  const seen = [];
  server.use(http.get(`${API_V2}/companies`, ({ request }) => {
    const q = new URL(request.url).searchParams;
    seen.push({ page: q.get('page'), search: q.get('search') });
    return HttpResponse.json({ items: [{ id: '1', name: 'Acme' }], page: Number(q.get('page')), pageSize: 25, total: 60, totalPages: 3 });
  }));
  renderPage();
  await screen.findByText('Acme');
  await userEvent.click(screen.getByRole('button', { name: /next page/i }));
  await waitFor(() => expect(seen.at(-1).page).toBe('2'));
  await userEvent.type(screen.getByPlaceholderText(/search companies/i), 'acme');
  await waitFor(() => expect(seen.at(-1)).toEqual({ page: '1', search: 'acme' }));
  expect(seen.filter((s) => s.search).map((s) => s.search)).toEqual(['acme']); // one request, not four
});

test('an empty result shows the empty state and no pager', async () => {
  server.use(http.get(`${API_V2}/companies`, () => HttpResponse.json({ items: [], page: 1, pageSize: 25, total: 0, totalPages: 0 })));
  renderPage();
  await waitFor(() => expect(screen.getByText(/no companies yet/i)).toBeInTheDocument());
  expect(screen.queryByRole('navigation', { name: /pagination/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- src/pages/Companies.test.jsx
```

Expected: FAIL — unhandled request to `${API}/companies` (the page still calls v1).

- [ ] **Step 3: Add `listCompaniesPage` to `src/api/companies.js`**

Replace lines 1–6 with:

```js
import api, { apiV2 } from './client';
import { compactParams } from './params';

// No argument = every row, on v1. ApplicationDrawer and ContactDrawer both call
// it that way to fill their company dropdown; point this at v2 and those
// dropdowns truncate even though their cache key never collides with the page's.
export async function listCompanies(search) {
  const { data } = await api.get('/companies', { params: search ? { search } : {} });
  return data;
}

// One page, on v2. Blanks are dropped — `?search=` is a 400, not "no filter".
export async function listCompaniesPage(params = {}) {
  const { data } = await apiV2.get('/companies', { params: compactParams(params) });
  return data;
}
```

Leave `createCompany` and `deleteCompany` untouched.

- [ ] **Step 4: Rewrite the top of `src/pages/Companies.jsx`**

Replace lines 1–25 with:

```jsx
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Search, Plus, Trash2, Building2 } from 'lucide-react';
import { listCompaniesPage, createCompany, deleteCompany } from '../api/companies';
import Button from '../components/Button';
import Pager from '../components/Pager';
import Spinner from '../components/Spinner';
import { DEFAULT_PAGE_SIZE, useClampedPage, useDebouncedValue } from '../lib/pagination';

export default function Companies() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Server-side search: filtering one page in memory would hide matching
  // companies sitting on every other page.
  const term = useDebouncedValue(search, 300).trim();

  // ['companies','page',…] is a distinct key from the bare ['companies'] the
  // drawers read, and a prefix match of it — so the invalidations below still
  // refresh both without naming them separately.
  const params = { page, pageSize, search: term, sort: 'createdAt', dir: 'desc' };
  const { data, isLoading } = useQuery({
    queryKey: ['companies', 'page', params],
    queryFn: () => listCompaniesPage(params),
    placeholderData: keepPreviousData,
  });

  const companies = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 0;

  useEffect(() => { setPage(1); }, [term, pageSize]);
  useClampedPage(page, totalPages, setPage);

  const create = useMutation({
    mutationFn: createCompany,
    onSuccess: () => { setName(''); qc.invalidateQueries({ queryKey: ['companies'] }); },
  });
  const remove = useMutation({
    mutationFn: deleteCompany,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companies'] }),
  });
```

- [ ] **Step 5: Add the pager to the render block**

In `src/pages/Companies.jsx`, change the list branch so the pager sits under the `<ul>`. Replace the closing of the ternary — the `) : (` … `)}` that wraps the `<ul>` — with:

```jsx
      ) : (
        <>
          <ul className="divide-y divide-sky-100 overflow-hidden rounded-xl border border-sky-100 bg-white">
            {companies.map((c) => (
              <li key={c.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium text-slate-900">{c.name}</p>
                  {(c.industry || c.location) && (
                    <p className="text-sm text-slate-500">{[c.industry, c.location].filter(Boolean).join(' · ')}</p>
                  )}
                </div>
                <Button variant="danger" aria-label={`Delete ${c.name}`} onClick={() => remove.mutate(c.id)}>
                  <Trash2 size={16} aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
          <Pager
            page={page}
            pageSize={pageSize}
            total={total}
            totalPages={totalPages}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </>
      )}
```

- [ ] **Step 6: Run the tests**

```bash
npm test -- src/pages/Companies.test.jsx
```

Expected: PASS (5 tests).

- [ ] **Step 7: Run the whole suite**

```bash
npm test
```

Expected: PASS. `ContactDrawer` and `ApplicationDrawer` still call `listCompanies()` with no argument on v1 — check `src/components/ContactDrawer.test.jsx` and `ApplicationDrawer.test.jsx` are green, since they are the drawers this task must not break.

- [ ] **Step 8: Commit**

```bash
git add src/api/companies.js src/pages/Companies.jsx src/pages/Companies.test.jsx
git commit -m "feat(companies): paginate the page on v2, drawers stay on the all-rows call"
```

---

### Task 7: Contacts page

Structurally identical to Task 6. Repeated in full rather than referenced, because the executor may be reading tasks out of order.

**Files:**
- Modify: `src/api/contacts.js:1-6`
- Modify: `src/pages/Contacts.jsx:1-25` and the render block
- Modify: `src/pages/Contacts.test.jsx`

**Interfaces:**
- Produces: `export async function listContactsPage(params?): Promise<{ items, page, pageSize, total, totalPages }>`

- [ ] **Step 1: Write the failing tests**

In `src/pages/Contacts.test.jsx`, change the import to `import { server, API, API_V2 } from '../test/server';`, add the envelope helper, and point every `http.get(`${API}/contacts`, …)` handler at `${API_V2}/contacts` wrapped in an envelope:

```jsx
const page = (items) => ({
  items, page: 1, pageSize: 25, total: items.length, totalPages: items.length ? 1 : 0,
});
```

So `lists contacts from the API` becomes:

```jsx
server.use(http.get(`${API_V2}/contacts`, () => HttpResponse.json(page([
  { id: '1', name: 'Jane Recruiter', position: 'Recruiter', company: { id: 'c1', name: 'Acme' }, email: 'jane@acme.com', linkedinUrl: '', followUpDate: null },
]))));
```

Apply the same rewrite to `search refetches with the term`, `Add contact opens the drawer in create mode`, `Edit on a card opens the drawer pre-filled`, `delete removes a contact`, and `delete refetches the list even while a search is active`. The `DELETE` handlers stay on `${API}` (writes are untouched). The `beforeEach` `${API}/companies` handler stays — `ContactDrawer` still uses it.

Then append:

```jsx
test('asks for page 1 at the default size and shows the count', async () => {
  let seen = null;
  server.use(http.get(`${API_V2}/contacts`, ({ request }) => {
    seen = Object.fromEntries(new URL(request.url).searchParams);
    return HttpResponse.json({
      items: [{ id: '1', name: 'Jane', position: '', company: null, email: '', linkedinUrl: '', followUpDate: null }],
      page: 1, pageSize: 25, total: 60, totalPages: 3,
    });
  }));
  renderPage();
  await waitFor(() => expect(screen.getByText('1–25 of 60')).toBeInTheDocument());
  expect(seen).toEqual({ page: '1', pageSize: '25', sort: 'createdAt', dir: 'desc' });
});

test('search is debounced, sent to the server, and resets the page', async () => {
  const seen = [];
  server.use(http.get(`${API_V2}/contacts`, ({ request }) => {
    const q = new URL(request.url).searchParams;
    seen.push({ page: q.get('page'), search: q.get('search') });
    return HttpResponse.json({
      items: [{ id: '1', name: 'Jane', position: '', company: null, email: '', linkedinUrl: '', followUpDate: null }],
      page: Number(q.get('page')), pageSize: 25, total: 60, totalPages: 3,
    });
  }));
  renderPage();
  await screen.findByText('Jane');
  await userEvent.click(screen.getByRole('button', { name: /next page/i }));
  await waitFor(() => expect(seen.at(-1).page).toBe('2'));
  await userEvent.type(screen.getByPlaceholderText(/search contacts/i), 'jan');
  await waitFor(() => expect(seen.at(-1)).toEqual({ page: '1', search: 'jan' }));
  expect(seen.filter((s) => s.search).map((s) => s.search)).toEqual(['jan']); // one request, not three
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- src/pages/Contacts.test.jsx
```

Expected: FAIL — unhandled request to `${API}/contacts`.

- [ ] **Step 3: Add `listContactsPage` to `src/api/contacts.js`**

Replace lines 1–6 with:

```js
import api, { apiV2 } from './client';
import { compactParams } from './params';

// No argument = every row, on v1. ApplicationDrawer calls it that way to fill
// its contact dropdown; point this at v2 and that dropdown truncates.
export async function listContacts(search) {
  const { data } = await api.get('/contacts', { params: search ? { search } : {} });
  return data;
}

// One page, on v2. Blanks are dropped — `?search=` is a 400, not "no filter".
export async function listContactsPage(params = {}) {
  const { data } = await apiV2.get('/contacts', { params: compactParams(params) });
  return data;
}
```

Leave `getContact`, `createContact`, `updateContact`, `deleteContact`, `linkContact`, `unlinkContact` untouched.

- [ ] **Step 4: Rewrite the top of `src/pages/Contacts.jsx`**

Replace lines 1–25 with:

```jsx
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Search, Plus, Trash2, Pencil, Users, Mail, Linkedin, CalendarClock } from 'lucide-react';
import { listContactsPage, deleteContact } from '../api/contacts';
import ContactDrawer from '../components/ContactDrawer';
import Button from '../components/Button';
import Pager from '../components/Pager';
import Spinner from '../components/Spinner';
import { DEFAULT_PAGE_SIZE, useClampedPage, useDebouncedValue } from '../lib/pagination';

const toDate = (v) => (v ? new Date(v).toISOString().slice(0, 10) : '');
const isOverdue = (v) => Boolean(v) && new Date(v) < new Date(new Date().toDateString());

export default function Contacts() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Server-side search: filtering one page in memory would hide matching
  // contacts sitting on every other page.
  const term = useDebouncedValue(search, 300).trim();

  // ['contacts','page',…] is distinct from the bare ['contacts'] the
  // ApplicationDrawer reads, and a prefix match of it — so the invalidation
  // below still refreshes both.
  const params = { page, pageSize, search: term, sort: 'createdAt', dir: 'desc' };
  const { data, isLoading } = useQuery({
    queryKey: ['contacts', 'page', params],
    queryFn: () => listContactsPage(params),
    placeholderData: keepPreviousData,
  });

  const contacts = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 0;

  useEffect(() => { setPage(1); }, [term, pageSize]);
  useClampedPage(page, totalPages, setPage);

  const remove = useMutation({
    mutationFn: deleteContact,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  });
```

- [ ] **Step 5: Add the pager to the render block**

Wrap the existing `<ul className="space-y-2">…</ul>` in a fragment and append the pager immediately after the closing `</ul>`:

```jsx
          <Pager
            page={page}
            pageSize={pageSize}
            total={total}
            totalPages={totalPages}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
```

The `<ul>` contents are unchanged.

- [ ] **Step 6: Run the tests**

```bash
npm test -- src/pages/Contacts.test.jsx src/components/ApplicationDrawer.test.jsx
```

Expected: PASS. The drawer test is included deliberately — it is the surface this task must not truncate.

- [ ] **Step 7: Commit**

```bash
git add src/api/contacts.js src/pages/Contacts.jsx src/pages/Contacts.test.jsx
git commit -m "feat(contacts): paginate the page on v2, drawer stays on the all-rows call"
```

---

### Task 8: Analysis history

The "Past analyses" list. Nothing else on the page changes — the Application and Résumé dropdowns keep reading their all-rows keys.

**Files:**
- Modify: `src/api/analysis.js:19-22`
- Modify: `src/pages/Analysis.jsx:1-10`, `:23`, and the `history.length > 0` block
- Modify: `src/pages/Analysis.test.jsx`

**Interfaces:**
- Produces: `export async function listAnalysesPage(params?): Promise<{ items, page, pageSize, total, totalPages }>`

`analysis` sorts on `createdAt | atsScore | matchScore` only. It **cannot** sort or search by `documentName` / `position` — those are projected out of `report.meta` JSON, not columns, and the API 400s on them. Do not add those affordances.

Page size defaults to **10** here, not 25: this is a secondary list under a form, and 10 is in the allowlist.

- [ ] **Step 1: Write the failing tests**

In `src/pages/Analysis.test.jsx`, change the import to `import { server, API, API_V2 } from '../test/server';`, and replace every `http.get(`${API}/analysis`, () => HttpResponse.json([...]))` with the v2 envelope form:

```jsx
const historyPage = (items) => ({
  items, page: 1, pageSize: 10, total: items.length, totalPages: items.length ? 1 : 0,
});
// …
http.get(`${API_V2}/analysis`, () => HttpResponse.json(historyPage([]))),
```

Leave `http.get(`${API}/analysis/config`, …)` and `http.post(`${API}/analysis`, …)` alone — only the list moves.

Then append:

```jsx
test('past analyses ask for page 1 at size 10, newest first', async () => {
  let seen = null;
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([])),
    http.get(`${API}/documents`, () => HttpResponse.json([])),
    http.get(`${API_V2}/analysis`, ({ request }) => {
      seen = Object.fromEntries(new URL(request.url).searchParams);
      return HttpResponse.json({
        items: [{ id: 'an1', documentName: 'Backend Resume', position: 'Backend Eng', atsScore: 82, matchScore: 67 }],
        page: 1, pageSize: 10, total: 34, totalPages: 4,
      });
    }),
  );
  renderPage();
  await waitFor(() => expect(screen.getByText('1–10 of 34')).toBeInTheDocument());
  expect(seen).toEqual({ page: '1', pageSize: '10', sort: 'createdAt', dir: 'desc' });
});

test('deleting the last row on the last page steps back a page', async () => {
  // v2 answers a past-the-end page with items: [] and a truthful total, so the
  // client recovers from totalPages rather than showing an empty list.
  let deleted = false;
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([])),
    http.get(`${API}/documents`, () => HttpResponse.json([])),
    http.get(`${API_V2}/analysis`, ({ request }) => {
      const p = Number(new URL(request.url).searchParams.get('page'));
      const total = deleted ? 10 : 11;
      const totalPages = Math.ceil(total / 10);
      const items = p > totalPages
        ? []
        : [{ id: `an-p${p}`, documentName: `Doc p${p}`, position: 'Eng', atsScore: 80, matchScore: 60 }];
      return HttpResponse.json({ items, page: p, pageSize: 10, total, totalPages });
    }),
    http.delete(`${API}/analysis/an-p2`, () => { deleted = true; return new HttpResponse(null, { status: 204 }); }),
  );
  renderPage();
  await screen.findByText('Doc p1');
  await userEvent.click(screen.getByRole('button', { name: 'Page 2' }));
  await screen.findByText('Doc p2');
  await userEvent.click(screen.getByRole('button', { name: /delete analysis of doc p2/i }));
  await waitFor(() => expect(screen.getByText('Doc p1')).toBeInTheDocument());
  expect(screen.getByText('1–10 of 10')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- src/pages/Analysis.test.jsx
```

Expected: FAIL — unhandled request to `${API}/analysis`.

- [ ] **Step 3: Add `listAnalysesPage` to `src/api/analysis.js`**

Change line 1 to:

```js
import api, { apiV2 } from './client';
import { compactParams } from './params';
```

and replace `listAnalyses` (lines 19–22) with:

```js
// Every row, on v1. No caller needs this today, but it is the escape hatch if
// one appears — and it keeps the v1/v2 pairing consistent across modules.
export async function listAnalyses() {
  const { data } = await api.get('/analysis');
  return data;
}

// One page, on v2. Sortable on createdAt | atsScore | matchScore only:
// documentName and position are projected out of report.meta JSON rather than
// stored as columns, so the API 400s on them.
export async function listAnalysesPage(params = {}) {
  const { data } = await apiV2.get('/analysis', { params: compactParams(params) });
  return data;
}
```

- [ ] **Step 4: Edit `src/pages/Analysis.jsx`**

Replace lines 1–9 (the whole import block) with:

```jsx
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { ScanSearch } from 'lucide-react';
import { listApplications, getApplication } from '../api/applications';
import { listDocuments } from '../api/documents';
import { runAnalysis, listAnalysesPage, getAnalysis, deleteAnalysis, getAnalysisConfig } from '../api/analysis';
import AnalysisReport from '../components/AnalysisReport';
import Button from '../components/Button';
import Pager from '../components/Pager';
import { useClampedPage } from '../lib/pagination';
import { trackEvent } from '../observability/analytics';
```

`listApplications` stays — the Application dropdown on this page is one of the four the Task 1 guard protects.

Replace line 23 (`const { data: history = [] } = useQuery({ queryKey: ['analyses'], … });`) with:

```jsx
  // A secondary list under a form, so 10 rather than the 25 default — still an
  // allowlisted size, which is what matters (anything else is a 400).
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(10);
  const historyParams = { page: historyPage, pageSize: historyPageSize, sort: 'createdAt', dir: 'desc' };
  const { data: historyData } = useQuery({
    queryKey: ['analyses', 'page', historyParams],
    queryFn: () => listAnalysesPage(historyParams),
    placeholderData: keepPreviousData,
  });
  const history = historyData?.items ?? [];
  const historyTotal = historyData?.total ?? 0;
  const historyTotalPages = historyData?.totalPages ?? 0;
  useClampedPage(historyPage, historyTotalPages, setHistoryPage);
```

Add a page reset when the size changes, directly below the `useClampedPage` call:

```jsx
  useEffect(() => { setHistoryPage(1); }, [historyPageSize]);
```

The two `qc.invalidateQueries({ queryKey: ['analyses'] })` calls on lines 36 and 47 stay exactly as they are — `['analyses']` prefix-matches the new key.

- [ ] **Step 5: Add the pager to the history block**

Change the `{history.length > 0 && (…)}` block's condition and append the pager after the `</ul>`:

```jsx
      {historyTotal > 0 && (
        <div className="mt-8">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Past analyses</h2>
          <ul className="space-y-2">
            {/* …existing <li> contents unchanged… */}
          </ul>
          <Pager
            page={historyPage}
            pageSize={historyPageSize}
            total={historyTotal}
            totalPages={historyTotalPages}
            onPageChange={setHistoryPage}
            onPageSizeChange={setHistoryPageSize}
          />
        </div>
      )}
```

- [ ] **Step 6: Run the tests**

```bash
npm test -- src/pages/Analysis.test.jsx src/pages/applicationDropdowns.test.jsx
```

Expected: PASS. The dropdown guard covers Analysis, so it must stay green.

- [ ] **Step 7: Commit**

```bash
git add src/api/analysis.js src/pages/Analysis.jsx src/pages/Analysis.test.jsx
git commit -m "feat(analysis): paginate the past-analyses history on v2"
```

---

### Task 9: Activity and the Dashboard preview

Activity is cursor-paginated and stays that way. **Do not give it a numbered pager** — offset over a feed that grows at the top re-serves rows. The only change is `limit` → `pageSize` and the allowlisted sizes.

**Files:**
- Modify: `src/api/activity.js`
- Modify: `src/pages/Activity.jsx:10-15`
- Modify: `src/pages/Dashboard.jsx:78`
- Modify: `src/pages/Activity.test.jsx`
- Modify: `src/pages/Dashboard.test.jsx` (only if it registers its own `${API}/activity` handler)

**Interfaces:**
- Produces: `export async function fetchActivityPage({ applicationId, before, pageSize }?): Promise<{ items, pageSize, nextCursor }>`

`ApplicationDrawer` keeps calling `fetchActivity({ applicationId })` on v1 — it renders one bounded per-application timeline and never pages.

- [ ] **Step 1: Write the failing tests**

In `src/pages/Activity.test.jsx`, change the import to `import { server, API, API_V2 } from '../test/server';` and repoint all four handlers from `${API}/activity` to `${API_V2}/activity`. Then append:

```jsx
test('asks v2 for an allowlisted pageSize and keeps the cursor pager', async () => {
  let seen = null;
  server.use(http.get(`${API_V2}/activity`, ({ request }) => {
    seen = Object.fromEntries(new URL(request.url).searchParams);
    return HttpResponse.json({ items: [ITEM()], pageSize: 25, nextCursor: null });
  }));
  renderPage();
  await waitFor(() => expect(screen.getByText('Created Backend Engineer')).toBeInTheDocument());
  // v2 renamed limit → pageSize and validates it instead of clamping.
  expect(seen).toEqual({ pageSize: '25' });
  // A numbered pager over an append-only feed re-serves rows: row 25 becomes
  // row 26 the moment a new event lands.
  expect(screen.queryByRole('navigation', { name: /pagination/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- src/pages/Activity.test.jsx
```

Expected: FAIL — the page still calls v1, so the v2 handler is never hit and `seen` stays null (and the default `${API_V2}/activity` handler from Task 2 answers with an empty feed).

- [ ] **Step 3: Add `fetchActivityPage` to `src/api/activity.js`**

Replace the whole file:

```js
import api, { apiV2 } from './client';
import { compactParams } from './params';

// v1. Still used by the ApplicationDrawer's per-application timeline, which
// renders one bounded list and never pages.
export async function fetchActivity({ applicationId, before } = {}) {
  const params = {};
  if (applicationId) params.applicationId = applicationId;
  if (before) params.before = before;
  const { data } = await api.get('/activity', { params });
  return data;
}

// v2. Cursor, not offset — activity is an append-only feed, and offset over a
// feed that grows at the top duplicates and skips rows. The size parameter is
// `pageSize` here (v1 called it `limit`) and is validated against the
// 10/25/50/100 allowlist rather than clamped, so an arbitrary number is a 400.
// Callers pass the size; this module deliberately does not reach into
// src/lib for the default, so the api layer stays free of React imports.
export async function fetchActivityPage({ applicationId, before, pageSize } = {}) {
  const { data } = await apiV2.get('/activity', {
    params: compactParams({ applicationId, before, pageSize }),
  });
  return data;
}
```

- [ ] **Step 4: Point `src/pages/Activity.jsx` at it**

Change line 3 to:

```jsx
import { fetchActivityPage } from '../api/activity';
import { DEFAULT_PAGE_SIZE } from '../lib/pagination';
```

and line 12 to:

```jsx
    queryFn: ({ pageParam }) => fetchActivityPage({ before: pageParam, pageSize: DEFAULT_PAGE_SIZE }),
```

Everything else on the page — the `useInfiniteQuery`, `getNextPageParam`, the "Load more" button — is already correct and stays.

- [ ] **Step 5: Point the Dashboard preview at it**

In `src/pages/Dashboard.jsx`, change line 6 to `import { fetchActivityPage } from '../api/activity';` and line 78 to:

```jsx
  // A six-item preview, so ask for the smallest allowlisted page rather than
  // pulling a default-sized one and throwing most of it away.
  const { data: activity } = useQuery({ queryKey: ['activity', 'recent'], queryFn: () => fetchActivityPage({ pageSize: 10 }) });
```

- [ ] **Step 6: Run the tests**

```bash
npm test -- src/pages/Activity.test.jsx src/pages/Dashboard.test.jsx src/components/ApplicationDrawer.test.jsx
```

Expected: PASS. If `Dashboard.test.jsx` registers its own `${API}/activity` handler, repoint it to `${API_V2}/activity` with a `{ items, pageSize, nextCursor }` body. `ApplicationDrawer` is included because it must still be on v1.

- [ ] **Step 7: Commit**

```bash
git add src/api/activity.js src/pages/Activity.jsx src/pages/Dashboard.jsx src/pages/Activity.test.jsx src/pages/Dashboard.test.jsx
git commit -m "feat(activity): move the feed and dashboard preview to v2 pageSize"
```

---

### Task 10: Full verification, 375px pass, and docs

**Files:**
- Modify: `SmartJobSearchCRM-FE/TASKS.md`
- Modify: `SmartJobSearchCRM-FE/TRACKER.md`
- Modify: `SmartJobSearchCRM/TRACKER.md` (root — flip the V3-29 row on line 86 to ☑ and add a dated changelog entry)

- [ ] **Step 1: Run the whole suite and the build**

```bash
npm test
npm run build
```

Expected: all green. Record the new test count — the baseline was **303 as of V3-27**.

- [ ] **Step 2: Confirm the backend is reachable before testing by hand**

v2 was merged (`842afd2`) but not deployed as of 2026-08-13. Check before assuming a failure is a frontend bug:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://smartjobsearch-api.onrender.com/api/v2/applications
```

`401` means v2 is deployed and simply wants auth — good. `404` means it is not deployed yet: run the backend locally (`cd ../SmartJobSearchCRM-BE && npm run dev`) for the manual pass, and **do not deploy this frontend** until v2 is live.

- [ ] **Step 3: The manual check that matters**

Start the app (`npm run dev`) against a database with **more than 25 applications**, then open each of the four dropdown pages — `/analysis`, `/interviews`, `/tailor`, `/cover-letter` — and confirm the "pick an application" `<select>` lists **every** application, not 25. Do this *after* visiting `/applications` in List view, so the paginated query is warm in the cache. This is the failure the whole plan is built around and it presents as missing data, not as a pagination bug.

- [ ] **Step 4: 375px pass (V3-27 rules)**

At a 375px viewport, on `/applications` (List view), `/companies`, `/contacts`, and `/analysis`:
- the pager is reachable without a horizontal pan of the page body
- the page buttons and the rows-per-page selector are ≥44px tall
- the count ("1–25 of 137") is visible and does not push the row off-screen
- switching to page 2 and back does not flash an empty table (`keepPreviousData`)

- [ ] **Step 5: Update the docs**

In `SmartJobSearchCRM-FE/TASKS.md`, extend the `## FE-3 — Applications Kanban + List ☑` section with a dated line recording that the List view is paginated on v2 while the board stays unpaginated, that Salary is no longer sortable, and that the company filter now reads the full companies list.

In `SmartJobSearchCRM-FE/TRACKER.md`, add a `2026-08-14 — **V3-29 …**` changelog entry in the same style as the existing dated entries: what changed, the key split that made it safe, the regression guard, and the final test count.

In the root `SmartJobSearchCRM/TRACKER.md`, change the V3-29 row (line 86) from `☐` to `☑` and append to its description: the actual test count, the fact that the four dropdowns are guarded by `src/pages/applicationDropdowns.test.jsx`, that Salary lost its sort, and that the company filter moved to the all-rows companies query.

- [ ] **Step 6: Commit and finish the branch**

```bash
git add TASKS.md TRACKER.md ../TRACKER.md
git commit -m "docs: record V3-29 frontend v2 pagination"
```

Then use **superpowers:finishing-a-development-branch** to decide how to integrate. Note in the merge description that **the backend must be deployed before this frontend is**.

---

## Deliberately out of scope

- **Retiring v1.** Both versions coexist; `listApplications()`, `listCompanies()`, `listContacts()`, `fetchActivity()` and their bare keys stay.
- **Paginating the Kanban board.** It needs every row.
- **A numbered pager for Activity.** Cursor is correct for an append-only feed.
- **`documentName` / `position` as sortable or searchable on Analysis.** Needs a backend migration + backfill.
- **URL-persisted pager state (`?page=2`).** Not asked for; adds router coupling to four pages.
- **Alphabetical default sort for Companies/Contacts.** They keep today's `createdAt desc` order — changing it is a UX decision, not a consequence of pagination.
