# Activity Log Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/activity` global feed page (day-grouped, "load more") and a per-application Activity timeline in the application drawer, both rendering events through one shared copy helper, and refresh activity after the mutations that produce events.

**Architecture:** A pure `src/lib/activityCopy.js` maps `(action, metadata)` → `{ icon, text }` (+ time helpers); a `src/components/ActivityRow.jsx` renders one event; `src/pages/Activity.jsx` (TanStack `useInfiniteQuery(['activity'])`) is the global feed; the application drawer gains an Activity section (`useQuery(['activity', id])`). Logged mutations invalidate `['activity']`. No new dependencies.

**Tech Stack:** React + Vite, TanStack Query (incl. `useInfiniteQuery`), React Router, Tailwind v4, lucide-react, Vitest + RTL + MSW.

## Global Constraints

- **Backend contract** (must match the BE plan): `GET /activity` → `{ items: Item[], nextCursor: string|null }`, `Item = { id, action, applicationId, metadata, createdAt }`. Params: `applicationId`, `limit`, `before` (ISO cursor). Actions: `ApplicationCreated`, `ApplicationStatusChanged`, `ApplicationDeleted`, `InterviewScheduled`, `InterviewResultRecorded`, `DocumentLinked`, `ContactLinked`. `metadata` carries `position` always, plus per-action fields (`{from,to}` / `{type,scheduledAt}` / `{type,result}` / `{name}`).
- Status enum values are raw (`HR_Screening`, `Technical_Interview`, `Final_Interview`) — humanize them in copy.
- Query keys: `['activity']` (global feed, `useInfiniteQuery`) and `['activity', applicationId]` (drawer). Mutations that produce logged events invalidate `['activity']` (prefix-matches both).
- Visual tokens per `DESIGN.md`: cards/rails `border-sky-100`, muted `slate-500`/`slate-400`, sky accent for icon bubbles, lucide icons (never emoji), visible focus rings, reuse `src/components/Button.jsx`.
- Tests use the existing harness: `src/test/server.js` (`server`, `API`), MSW `server.use(...)` per test, `onUnhandledRequest: 'error'`.
- Built per `DESIGN.md` (ui-ux-pro-max). Commit trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Copy helper + ActivityRow

**Files:**
- Create: `src/lib/activityCopy.js`
- Create: `src/lib/activityCopy.test.js`
- Create: `src/components/ActivityRow.jsx`

**Interfaces:**
- Produces: `activityCopy(action, metadata) → { icon, text }`; `relativeTime(iso, now?) → string`; `dayBucket(iso, now?) → string`; default-exported `<ActivityRow item />`.

- [ ] **Step 1: Write the failing helper tests**

Create `src/lib/activityCopy.test.js`:

```js
import { activityCopy, relativeTime, dayBucket } from './activityCopy';

test('renders a sentence + icon per action', () => {
  expect(activityCopy('ApplicationCreated', { position: 'Backend Engineer' }).text).toBe('Created Backend Engineer');
  expect(activityCopy('ApplicationStatusChanged', { position: 'BE', from: 'Applied', to: 'Technical_Interview' }).text)
    .toBe('Moved BE from Applied to Technical Interview');
  expect(activityCopy('InterviewScheduled', { position: 'BE', type: 'Technical' }).text)
    .toBe('Scheduled a Technical interview for BE');
  expect(activityCopy('InterviewResultRecorded', { position: 'BE', type: 'HR', result: 'Passed' }).text)
    .toMatch(/Recorded Passed/);
  expect(activityCopy('DocumentLinked', { position: 'BE', name: 'Resume v2' }).text).toBe('Attached Resume v2 to BE');
  expect(activityCopy('ContactLinked', { position: 'BE', name: 'Jane' }).text).toBe('Added Jane to BE');
  expect(activityCopy('ApplicationDeleted', { position: 'BE' }).text).toBe('Deleted BE');
  // every action yields a renderable icon component
  expect(typeof activityCopy('ApplicationCreated', {}).icon).toBe('function');
});

test('relativeTime formats recent timestamps', () => {
  const now = new Date('2026-06-24T12:00:00Z').getTime();
  expect(relativeTime('2026-06-24T11:59:30Z', now)).toBe('just now');
  expect(relativeTime('2026-06-24T11:30:00Z', now)).toBe('30m ago');
  expect(relativeTime('2026-06-24T09:00:00Z', now)).toBe('3h ago');
});

test('dayBucket labels today/yesterday', () => {
  const now = new Date('2026-06-24T12:00:00Z');
  expect(dayBucket('2026-06-24T08:00:00Z', now)).toBe('Today');
  expect(dayBucket('2026-06-23T08:00:00Z', now)).toBe('Yesterday');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- activityCopy`
Expected: FAIL — `Failed to resolve import './activityCopy'`.

- [ ] **Step 3: Implement the helper**

Create `src/lib/activityCopy.js`:

```js
import { FilePlus2, ArrowRightLeft, Trash2, CalendarClock, CheckCircle2, FileText, UserPlus, Activity } from 'lucide-react';

const STATUS_LABEL = {
  Draft: 'Draft', Applied: 'Applied', HR_Screening: 'HR Screening',
  Technical_Interview: 'Technical Interview', Final_Interview: 'Final Interview',
  Offer: 'Offer', Accepted: 'Accepted', Rejected: 'Rejected', Withdrawn: 'Withdrawn',
};
const label = (s) => STATUS_LABEL[s] || s;

export function activityCopy(action, metadata = {}) {
  const pos = metadata.position || 'an application';
  switch (action) {
    case 'ApplicationCreated': return { icon: FilePlus2, text: `Created ${pos}` };
    case 'ApplicationStatusChanged': return { icon: ArrowRightLeft, text: `Moved ${pos} from ${label(metadata.from)} to ${label(metadata.to)}` };
    case 'ApplicationDeleted': return { icon: Trash2, text: `Deleted ${pos}` };
    case 'InterviewScheduled': return { icon: CalendarClock, text: `Scheduled a ${metadata.type} interview for ${pos}` };
    case 'InterviewResultRecorded': return { icon: CheckCircle2, text: `Recorded ${metadata.result} for the ${metadata.type} interview (${pos})` };
    case 'DocumentLinked': return { icon: FileText, text: `Attached ${metadata.name} to ${pos}` };
    case 'ContactLinked': return { icon: UserPlus, text: `Added ${metadata.name} to ${pos}` };
    default: return { icon: Activity, text: 'Activity' };
  }
}

export function relativeTime(iso, now = Date.now()) {
  const sec = Math.round((now - new Date(iso).getTime()) / 1000);
  if (sec < 60) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function dayBucket(iso, now = new Date()) {
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(new Date(iso))) / 86400000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return new Date(iso).toLocaleDateString();
}
```

- [ ] **Step 4: Create the row component**

Create `src/components/ActivityRow.jsx`:

```jsx
import { activityCopy, relativeTime } from '../lib/activityCopy';

export default function ActivityRow({ item }) {
  const { icon: Icon, text } = activityCopy(item.action, item.metadata);
  return (
    <li className="flex items-start gap-3 py-2">
      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sky-50 text-sky-700">
        <Icon size={15} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-slate-800">{text}</p>
        <p className="text-xs text-slate-400">{relativeTime(item.createdAt)}</p>
      </div>
    </li>
  );
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- activityCopy`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/activityCopy.js src/lib/activityCopy.test.js src/components/ActivityRow.jsx
git commit -m "feat(activity): activityCopy helper + ActivityRow component

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: API module + Activity page + route + nav

**Files:**
- Create: `src/api/activity.js`
- Create: `src/pages/Activity.jsx`
- Create: `src/pages/Activity.test.jsx`
- Modify: `src/App.jsx` (route)
- Modify: `src/components/Layout.jsx` (nav item)
- Modify: `src/components/Layout.test.jsx` (nav assertion)
- Modify: `src/test/server.js` (default `GET /activity` handler)

**Interfaces:**
- Produces: `fetchActivity({ applicationId, before } = {}) → Promise<{ items, nextCursor }>`; default-exported `<Activity />`.
- Consumes: `ActivityRow` + `dayBucket` (Task 1).

- [ ] **Step 1: Create the API module**

Create `src/api/activity.js`:

```js
import api from './client';

export async function fetchActivity({ applicationId, before } = {}) {
  const params = {};
  if (applicationId) params.applicationId = applicationId;
  if (before) params.before = before;
  const { data } = await api.get('/activity', { params });
  return data;
}
```

- [ ] **Step 2: Add a default handler so the drawer's query (Task 3) and any render don't error**

In `src/test/server.js`, add to the `handlers` array:

```js
  http.get(`${API}/activity`, () =>
    HttpResponse.json({ items: [], nextCursor: null })),
```

- [ ] **Step 3: Write the failing page tests**

Create `src/pages/Activity.test.jsx`:

```jsx
import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { server, API } from '../test/server';
import Activity from './Activity';

const ITEM = (over) => ({
  id: 'e1', action: 'ApplicationCreated', applicationId: 'a1',
  metadata: { position: 'Backend Engineer' }, createdAt: new Date().toISOString(), ...over,
});

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Activity />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

test('renders activity events', async () => {
  server.use(http.get(`${API}/activity`, () => HttpResponse.json({
    items: [ITEM(), ITEM({ id: 'e2', action: 'DocumentLinked', metadata: { position: 'Backend Engineer', name: 'Resume v2' } })],
    nextCursor: null,
  })));
  renderPage();
  await waitFor(() => expect(screen.getByText('Created Backend Engineer')).toBeInTheDocument());
  expect(screen.getByText('Attached Resume v2 to Backend Engineer')).toBeInTheDocument();
});

test('"Load more" fetches the next page with before=', async () => {
  let sawBefore = null;
  server.use(http.get(`${API}/activity`, ({ request }) => {
    const before = new URL(request.url).searchParams.get('before');
    if (!before) return HttpResponse.json({ items: [ITEM({ id: 'p1', metadata: { position: 'First' } })], nextCursor: '2026-06-24T00:00:00.000Z' });
    sawBefore = before;
    return HttpResponse.json({ items: [ITEM({ id: 'p2', metadata: { position: 'Second' } })], nextCursor: null });
  }));
  renderPage();
  await waitFor(() => expect(screen.getByText('Created First')).toBeInTheDocument());
  await userEvent.click(screen.getByRole('button', { name: /load more/i }));
  await waitFor(() => expect(screen.getByText('Created Second')).toBeInTheDocument());
  expect(sawBefore).toBe('2026-06-24T00:00:00.000Z');
});

test('shows an empty state', async () => {
  server.use(http.get(`${API}/activity`, () => HttpResponse.json({ items: [], nextCursor: null })));
  renderPage();
  await waitFor(() => expect(screen.getByText(/no activity yet/i)).toBeInTheDocument());
});

test('shows an error state', async () => {
  server.use(http.get(`${API}/activity`, () =>
    HttpResponse.json({ error: { message: 'boom', code: 'SERVER_ERROR' } }, { status: 500 })));
  renderPage();
  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npm test -- Activity`
Expected: FAIL — `Failed to resolve import './Activity'`.

- [ ] **Step 5: Implement the Activity page**

Create `src/pages/Activity.jsx`:

```jsx
import { useInfiniteQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import { fetchActivity } from '../api/activity';
import { dayBucket } from '../lib/activityCopy';
import ActivityRow from '../components/ActivityRow';
import Button from '../components/Button';

export default function Activity() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } = useInfiniteQuery({
    queryKey: ['activity'],
    queryFn: ({ pageParam }) => fetchActivity({ before: pageParam }),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const items = data?.pages.flatMap((p) => p.items) ?? [];

  // group consecutive items by day bucket, preserving newest-first order
  const groups = [];
  for (const item of items) {
    const bucket = dayBucket(item.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.bucket === bucket) last.items.push(item);
    else groups.push({ bucket, items: [item] });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-5 text-2xl font-bold text-slate-900">Activity</h1>

      {isLoading && <p className="text-slate-500">Loading…</p>}

      {isError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Couldn’t load activity. Please try again.
        </div>
      )}

      {!isLoading && !isError && (items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-sky-200 bg-white p-10 text-center text-slate-500">
          <History className="mx-auto mb-2 text-slate-300" size={28} aria-hidden="true" />
          No activity yet. Your job-search timeline will show up here.
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <section key={g.bucket}>
              <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{g.bucket}</h2>
              <ul className="rounded-xl border border-sky-100 bg-white px-4 py-1 shadow-sm">
                {g.items.map((item) => <ActivityRow key={item.id} item={item} />)}
              </ul>
            </section>
          ))}
          {hasNextPage && (
            <div className="text-center">
              <Button variant="subtle" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                {isFetchingNextPage ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Add the route**

In `src/App.jsx`, import the page and add the route after `/documents`, inside the protected `<Layout />` group:

```jsx
import Activity from './pages/Activity';
```
```jsx
<Route path="/activity" element={<Activity />} />
```

- [ ] **Step 7: Add the nav item**

In `src/components/Layout.jsx`, add `History` to the lucide import, and insert the entry into `NAV` immediately after Documents:

```jsx
  { to: '/activity', label: 'Activity', icon: History },
```

- [ ] **Step 8: Add the Layout nav test**

In `src/components/Layout.test.jsx`, add:

```jsx
test('renders an Activity nav link', () => {
  renderLayout();
  expect(screen.getAllByRole('link', { name: /activity/i }).length).toBeGreaterThan(0);
});
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `npm test -- Activity Layout`
Expected: PASS (4 Activity page tests + the Layout suite incl. the new Activity link).

- [ ] **Step 10: Commit**

```bash
git add src/api/activity.js src/pages/Activity.jsx src/pages/Activity.test.jsx src/App.jsx src/components/Layout.jsx src/components/Layout.test.jsx src/test/server.js
git commit -m "feat(activity): /activity feed page (day-grouped + load more) + nav

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Drawer timeline + activity invalidation

**Files:**
- Modify: `src/components/ApplicationDrawer.jsx`
- Modify: `src/components/ApplicationDrawer.test.jsx`
- Modify: `src/pages/Applications.jsx` (invalidate `['activity']` on status move)

**Interfaces:**
- Consumes: `fetchActivity` (Task 2), `ActivityRow` (Task 1).

> **Read first:** open `src/components/ApplicationDrawer.jsx` and locate the existing per-application queries (e.g. the `['application', application?.id]` detail query) and the logged mutations (`addInterview`, `setInterviewResult`, `linkContactM`, `linkDocumentM`, `quickCreateContactM`, the save mutation, the delete mutation). You will add an activity query + section and one `qc.invalidateQueries({ queryKey: ['activity'] })` line to each logged mutation's `onSuccess`.

- [ ] **Step 1: Write the failing drawer test (append to `src/components/ApplicationDrawer.test.jsx`)**

```jsx
test('shows the per-application activity timeline', async () => {
  server.use(
    http.get(`${API}/activity`, ({ request }) => {
      const appId = new URL(request.url).searchParams.get('applicationId');
      if (appId === 'a1') return HttpResponse.json({
        items: [{ id: 'e1', action: 'ApplicationStatusChanged', applicationId: 'a1',
          metadata: { position: 'Backend Eng', from: 'Draft', to: 'Applied' }, createdAt: new Date().toISOString() }],
        nextCursor: null,
      });
      return HttpResponse.json({ items: [], nextCursor: null });
    }),
  );
  renderDrawer({ application: app });
  expect(await screen.findByText('Moved Backend Eng from Draft to Applied')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- ApplicationDrawer -t "activity timeline"`
Expected: FAIL — the timeline isn't rendered yet.

- [ ] **Step 3: Add the activity query + imports**

In `src/components/ApplicationDrawer.jsx`:
- Add imports:

```jsx
import { fetchActivity } from '../api/activity';
import ActivityRow from './ActivityRow';
```
- Add a query alongside the other per-application queries:

```jsx
  const { data: activity } = useQuery({
    queryKey: ['activity', application?.id],
    queryFn: () => fetchActivity({ applicationId: application.id }),
    enabled: open && isEdit,
  });
  const activityItems = activity?.items || [];
```

- [ ] **Step 4: Add the Activity section markup**

In `src/components/ApplicationDrawer.jsx`, after the Documents `{isEdit && (...)}` section and before `</aside>`, add:

```jsx
        {isEdit && (
          <div className="border-t border-sky-100 px-5 py-4">
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Activity</h3>
            {activityItems.length === 0 ? (
              <p className="text-sm text-slate-400">No activity yet.</p>
            ) : (
              <ul>{activityItems.map((item) => <ActivityRow key={item.id} item={item} />)}</ul>
            )}
          </div>
        )}
```

- [ ] **Step 5: Invalidate `['activity']` from logged mutations**

In `src/components/ApplicationDrawer.jsx`, add `qc.invalidateQueries({ queryKey: ['activity'] });` to the `onSuccess` of each of these mutations (alongside their existing invalidations): `addInterview`, `setInterviewResult`, `linkContactM`, `linkDocumentM`, `quickCreateContactM`, the save mutation (create/update application), and the delete mutation. Example for `linkDocumentM`:

```jsx
  const linkDocumentM = useMutation({
    mutationFn: (documentId) => linkDocument(application.id, documentId),
    onSuccess: () => {
      setSelectedDocumentId('');
      qc.invalidateQueries({ queryKey: ['application', application.id] });
      qc.invalidateQueries({ queryKey: ['activity'] });
    },
    onError: (e) => setError(e.response?.data?.error?.message || 'Could not link document'),
  });
```

Apply the same one-line addition to the other six mutations' `onSuccess` handlers.

- [ ] **Step 6: Invalidate `['activity']` on Kanban status move**

In `src/pages/Applications.jsx`, in `moveMutationOptions(qc)`, extend the `onSettled` to also invalidate activity:

```jsx
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['applications'] });
      qc.invalidateQueries({ queryKey: ['activity'] });
    },
```

- [ ] **Step 7: Run the drawer tests to verify they pass**

Run: `npm test -- ApplicationDrawer`
Expected: PASS (existing drawer tests + the new activity-timeline test).

- [ ] **Step 8: Run the full frontend suite + build**

Run: `npm test`
Expected: PASS — the prior 84 tests, plus 3 activityCopy + 4 Activity page + 1 Layout + 1 ApplicationDrawer = **93 total**.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 9: Commit**

```bash
git add src/components/ApplicationDrawer.jsx src/components/ApplicationDrawer.test.jsx src/pages/Applications.jsx
git commit -m "feat(activity): per-application timeline in the drawer + refresh on logged actions

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

- **Spec coverage:** `/activity` global feed page, day-grouped + "load more" (Task 2) ✓; per-application timeline in the drawer (Task 3) ✓; shared `activityCopy` helper + `ActivityRow` reused by both (Tasks 1–3) ✓; sidebar "Activity" nav after Documents (Task 2) ✓; `fetchActivity` API + query keys `['activity']` / `['activity', id]` (Tasks 2–3) ✓; mutations that log invalidate `['activity']` (Task 3) ✓; loading/empty/error states (Task 2) ✓; default MSW handler so drawer tests don't error (Task 2) ✓.
- **Type consistency:** the `Item` shape (`{id,action,applicationId,metadata,createdAt}`) and metadata fields read by `activityCopy` match the BE plan's response; action strings are identical to the `ActivityAction` enum; query keys `['activity']` (infinite, global) and `['activity', id]` (drawer) are consistent and both prefix-matched by the `['activity']` invalidations.
- **Placeholders:** none — every step has complete code and exact commands, except Task 3's deliberate "apply the same one-line `['activity']` invalidation to the other six mutations" instruction (the mutations already exist in the file; the example shows the exact edit).
