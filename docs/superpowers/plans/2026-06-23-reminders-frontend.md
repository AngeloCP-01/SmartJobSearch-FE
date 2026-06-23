# Reminders Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated `/reminders` page (grouped interview + follow-up reminders, with a "Mark done" action on follow-ups) and a count badge on a new sidebar nav item, consuming `GET /api/reminders`.

**Architecture:** A new `src/pages/Reminders.jsx` driven by `useQuery(['reminders'])`, a `src/api/reminders.js` fetcher, a route in `App.jsx`, and a new "Reminders" sidebar item in `Layout.jsx` that runs the same query to show a badge. The "Mark done" action reuses the existing `updateContact` mutation. No new dependencies.

**Tech Stack:** React + Vite, TanStack Query, React Router, Tailwind v4, lucide-react, Vitest + RTL + MSW.

## Global Constraints

- **Backend contract** (must match the BE plan exactly): `GET /api/reminders` →
  `{ interviews: { upcoming: Item[], overdue: Item[] }, followUps: { due: F[], upcoming: F[] }, counts: { total, interviews, followUps } }`
  where `Item = { id, type, scheduledAt, result, application: { id, position, company: {id,name}|null } }` and `F = { id, name, position, followUpDate, company: {id,name}|null }`.
- "Mark done" → `updateContact(id, { followUpDate: null })` (existing `src/api/contacts.js`); on success invalidate `['reminders']` and `['contacts']`.
- Query key `['reminders']` (page + sidebar badge share it — one request).
- Visual tokens per `DESIGN.md`: cards `rounded-xl border border-sky-100 bg-white shadow-sm p-5`; muted text `slate-500`; lucide icons (never emoji); amber pill `bg-amber-100 text-amber-800` for due/overdue, sky pill `bg-sky-100 text-sky-800` for upcoming; visible focus rings.
- Reuse `src/components/Button.jsx` (`variant="subtle"`, forwards `aria-label`/`onClick`).
- Tests use the existing harness: `src/test/server.js` (`server`, `API`), MSW `server.use(...)` per test, `onUnhandledRequest: 'error'`.
- `Layout` runs `useQuery` once this lands, so any test rendering `<Layout/>` needs a `QueryClientProvider` and a `GET /api/reminders` MSW handler (added as a default in Task 2).
- Built per `DESIGN.md` (ui-ux-pro-max). Commit trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: API module + Reminders page + route

**Files:**
- Create: `src/api/reminders.js`
- Create: `src/pages/Reminders.jsx`
- Create: `src/pages/Reminders.test.jsx`
- Modify: `src/App.jsx` (route)

**Interfaces:**
- Produces: `fetchReminders() → Promise<RemindersPayload>` (the contract above); default-exported `<Reminders />` page.
- Consumes: `api` from `src/api/client.js`; `updateContact` from `src/api/contacts.js`; `Button` from `src/components/Button.jsx`.

- [ ] **Step 1: Create the API module**

Create `src/api/reminders.js`:

```js
import api from './client';

export async function fetchReminders() {
  const { data } = await api.get('/reminders');
  return data;
}
```

- [ ] **Step 2: Write the failing page tests**

Create `src/pages/Reminders.test.jsx`:

```jsx
import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { server, API } from '../test/server';
import Reminders from './Reminders';

const PAYLOAD = {
  interviews: {
    upcoming: [{ id: 'i1', type: 'Technical', scheduledAt: '2026-06-25T14:00:00.000Z', result: null,
      application: { id: 'a1', position: 'Backend Engineer', company: { id: 'c1', name: 'Acme' } } }],
    overdue: [{ id: 'i2', type: 'HR', scheduledAt: '2026-06-20T10:00:00.000Z', result: null,
      application: { id: 'a2', position: 'Frontend Dev', company: null } }],
  },
  followUps: {
    due: [{ id: 'ct1', name: 'Jane Recruiter', position: 'Recruiter',
      followUpDate: '2026-06-20T00:00:00.000Z', company: { id: 'c1', name: 'Acme' } }],
    upcoming: [{ id: 'ct2', name: 'Bob Hiring', position: 'EM',
      followUpDate: '2026-06-26T00:00:00.000Z', company: null }],
  },
  counts: { total: 4, interviews: 2, followUps: 2 },
};
const EMPTY = {
  interviews: { upcoming: [], overdue: [] },
  followUps: { due: [], upcoming: [] },
  counts: { total: 0, interviews: 0, followUps: 0 },
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Reminders />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

test('renders interview and follow-up reminders', async () => {
  server.use(http.get(`${API}/reminders`, () => HttpResponse.json(PAYLOAD)));
  renderPage();
  await waitFor(() => expect(screen.getByText('Backend Engineer')).toBeInTheDocument());
  expect(screen.getByText('Frontend Dev')).toBeInTheDocument();
  expect(screen.getByText('Jane Recruiter')).toBeInTheDocument();
  expect(screen.getByText('Bob Hiring')).toBeInTheDocument();
  expect(screen.getAllByText(/overdue/i).length).toBeGreaterThan(0);
});

test('Mark done clears the follow-up via PATCH', async () => {
  let patchedBody = null;
  server.use(
    http.get(`${API}/reminders`, () => HttpResponse.json(PAYLOAD)),
    http.patch(`${API}/contacts/ct1`, async ({ request }) => {
      patchedBody = await request.json();
      return HttpResponse.json({ id: 'ct1', name: 'Jane Recruiter', followUpDate: null });
    }),
  );
  renderPage();
  await waitFor(() => expect(screen.getByText('Jane Recruiter')).toBeInTheDocument());
  await userEvent.click(screen.getByRole('button', { name: /mark follow-up with jane recruiter done/i }));
  await waitFor(() => expect(patchedBody).toEqual({ followUpDate: null }));
});

test('shows an empty state when there are no reminders', async () => {
  server.use(http.get(`${API}/reminders`, () => HttpResponse.json(EMPTY)));
  renderPage();
  await waitFor(() => expect(screen.getByText(/all caught up/i)).toBeInTheDocument());
});

test('shows a loading state while fetching', () => {
  server.use(http.get(`${API}/reminders`, () => HttpResponse.json(EMPTY)));
  renderPage();
  expect(screen.getByText('Loading…')).toBeInTheDocument();
});

test('shows an error state when the request fails', async () => {
  server.use(http.get(`${API}/reminders`, () =>
    HttpResponse.json({ error: { message: 'boom', code: 'SERVER_ERROR' } }, { status: 500 })));
  renderPage();
  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test -- Reminders`
Expected: FAIL — `Failed to resolve import './Reminders'` (page not created yet).

- [ ] **Step 4: Implement the Reminders page**

Create `src/pages/Reminders.jsx`:

```jsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Bell, CalendarClock, Users, CheckCircle2 } from 'lucide-react';
import { fetchReminders } from '../api/reminders';
import { updateContact } from '../api/contacts';
import Button from '../components/Button';

const fmt = (v) => new Date(v).toLocaleDateString();
const sub = (a, b) => [a, b].filter(Boolean).join(' · ');

function Card({ title, icon: Icon, children }) {
  return (
    <div className="rounded-xl border border-sky-100 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-slate-500">
        <Icon size={18} aria-hidden="true" />
        <span className="text-sm font-medium">{title}</span>
      </div>
      {children}
    </div>
  );
}

function Pill({ tone, children }) {
  const cls = tone === 'overdue' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {children}
    </span>
  );
}

function InterviewRow({ item, overdue }) {
  return (
    <Link
      to="/interviews"
      className="flex items-center justify-between rounded-lg border border-sky-100 px-3 py-2 hover:bg-sky-50
        focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
    >
      <div className="min-w-0">
        <p className="font-medium text-slate-900">{item.type}</p>
        <p className="text-sm text-slate-500">{sub(item.application?.position, item.application?.company?.name)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2 text-sm text-slate-500">
        <span>{fmt(item.scheduledAt)}</span>
        {overdue && <Pill tone="overdue">overdue</Pill>}
      </div>
    </Link>
  );
}

export default function Reminders() {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({ queryKey: ['reminders'], queryFn: fetchReminders });
  const markDone = useMutation({
    mutationFn: (id) => updateContact(id, { followUpDate: null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reminders'] });
      qc.invalidateQueries({ queryKey: ['contacts'] });
    },
  });

  const FollowUpRow = ({ contact, tone }) => (
    <li className="flex items-center justify-between rounded-lg border border-sky-100 px-3 py-2">
      <div className="min-w-0">
        <Link to="/contacts" className="font-medium text-slate-900 hover:underline">{contact.name}</Link>
        <p className="text-sm text-slate-500">{sub(contact.position, contact.company?.name)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2 text-sm text-slate-500">
        <span>{fmt(contact.followUpDate)}</span>
        <Pill tone={tone}>{tone === 'overdue' ? 'due' : 'upcoming'}</Pill>
        <Button
          variant="subtle"
          aria-label={`Mark follow-up with ${contact.name} done`}
          onClick={() => markDone.mutate(contact.id)}
        >
          <CheckCircle2 size={16} aria-hidden="true" /> Mark done
        </Button>
      </div>
    </li>
  );

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-5 text-2xl font-bold text-slate-900">Reminders</h1>

      {isLoading && <p className="text-slate-500">Loading…</p>}

      {isError && !data && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Couldn’t load reminders. Please try again.
        </div>
      )}

      {data && (
        data.counts.total === 0 ? (
          <div className="rounded-xl border border-dashed border-sky-200 bg-white p-10 text-center text-slate-500">
            <Bell className="mx-auto mb-2 text-slate-300" size={28} aria-hidden="true" />
            You’re all caught up — no reminders right now.
          </div>
        ) : (
          <div className="space-y-4">
            {data.counts.interviews > 0 && (
              <Card title="Interviews" icon={CalendarClock}>
                <div className="space-y-2">
                  {data.interviews.overdue.map((i) => <InterviewRow key={i.id} item={i} overdue />)}
                  {data.interviews.upcoming.map((i) => <InterviewRow key={i.id} item={i} />)}
                </div>
              </Card>
            )}
            {data.counts.followUps > 0 && (
              <Card title="Follow-ups" icon={Users}>
                <ul className="space-y-2">
                  {data.followUps.due.map((c) => <FollowUpRow key={c.id} contact={c} tone="overdue" />)}
                  {data.followUps.upcoming.map((c) => <FollowUpRow key={c.id} contact={c} tone="upcoming" />)}
                </ul>
              </Card>
            )}
          </div>
        )
      )}
    </div>
  );
}
```

- [ ] **Step 5: Add the route**

Modify `src/App.jsx` — import the page and add the route directly after the `/` (Dashboard) route, inside the protected `<Layout />` group:

```jsx
import Reminders from './pages/Reminders';
```
```jsx
<Route path="/reminders" element={<Reminders />} />
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test -- Reminders`
Expected: PASS (all 5 Reminders page tests).

- [ ] **Step 7: Commit**

```bash
git add src/api/reminders.js src/pages/Reminders.jsx src/pages/Reminders.test.jsx src/App.jsx
git commit -m "feat(reminders): /reminders page with grouped lists + mark-done action

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Sidebar nav item + count badge

Adds the "Reminders" nav item and a badge driven by the shared `['reminders']` query. Because `Layout` now calls `useQuery`, this task also adds a default MSW handler and wraps the Layout tests in a `QueryClientProvider`.

**Files:**
- Modify: `src/components/Layout.jsx`
- Modify: `src/test/server.js` (default `GET /api/reminders` handler)
- Modify: `src/components/Layout.test.jsx` (provider wrapper + nav/badge tests)

**Interfaces:**
- Consumes: `fetchReminders` from `src/api/reminders.js` (Task 1).
- Produces: a "Reminders" nav link (route `/reminders`) with a badge showing `counts.total` when > 0.

- [ ] **Step 1: Add a default reminders handler (so Layout's query doesn't error in tests)**

In `src/test/server.js`, add to the `handlers` array:

```js
  http.get(`${API}/reminders`, () =>
    HttpResponse.json({
      interviews: { upcoming: [], overdue: [] },
      followUps: { due: [], upcoming: [] },
      counts: { total: 0, interviews: 0, followUps: 0 },
    })),
```

- [ ] **Step 2: Write the failing Layout tests**

Replace the contents of `src/components/Layout.test.jsx` with (keeps the existing Contacts + Analytics assertions, adds the provider wrapper and the Reminders nav + badge tests):

```jsx
import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';
import { server, API } from '../test/server';
import Layout from './Layout';

function renderLayout() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <MemoryRouter initialEntries={['/']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Layout />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

test('renders a Contacts nav link', () => {
  renderLayout();
  expect(screen.getAllByRole('link', { name: /contacts/i }).length).toBeGreaterThan(0);
});

test('renders an Analytics nav link', () => {
  renderLayout();
  expect(screen.getAllByRole('link', { name: /analytics/i }).length).toBeGreaterThan(0);
});

test('renders a Reminders nav link', () => {
  renderLayout();
  expect(screen.getAllByRole('link', { name: /reminders/i }).length).toBeGreaterThan(0);
});

test('shows a badge with the reminders count', async () => {
  server.use(http.get(`${API}/reminders`, () => HttpResponse.json({
    interviews: { upcoming: [], overdue: [] },
    followUps: { due: [], upcoming: [] },
    counts: { total: 3, interviews: 2, followUps: 1 },
  })));
  renderLayout();
  await waitFor(() => expect(screen.getAllByLabelText('3 reminders').length).toBeGreaterThan(0));
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test -- Layout`
Expected: FAIL — no "Reminders" link / no `3 reminders` badge yet (and `useQuery` would error without the provider, which the new wrapper now supplies).

- [ ] **Step 4: Add the nav item + badge to Layout**

Modify `src/components/Layout.jsx`:

- Extend the imports (add `useQuery`, `fetchReminders`, and the `Bell` icon):

```jsx
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Bell, LineChart, KanbanSquare, Building2, Users, CalendarClock, LogOut, Briefcase } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { fetchReminders } from '../api/reminders';
```

- Insert the Reminders entry into `NAV` immediately after Dashboard:

```jsx
const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/reminders', label: 'Reminders', icon: Bell },
  { to: '/analytics', label: 'Analytics', icon: LineChart },
  { to: '/applications', label: 'Applications', icon: KanbanSquare },
  { to: '/companies', label: 'Companies', icon: Building2 },
  { to: '/contacts', label: 'Contacts', icon: Users },
  { to: '/interviews', label: 'Interviews', icon: CalendarClock },
];
```

- Change `NavLinks` to render the badge for the reminders item:

```jsx
function NavLinks({ onNavigate, reminderCount = 0 }) {
  return NAV.map(({ to, label, icon: Icon, end }) => (
    <NavLink key={to} to={to} end={end} className={navClass} onClick={onNavigate}>
      <Icon size={18} aria-hidden="true" />
      <span>{label}</span>
      {to === '/reminders' && reminderCount > 0 && (
        <span
          aria-label={`${reminderCount} reminders`}
          className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-sky-600 px-1.5 text-xs font-semibold text-white"
        >
          {reminderCount}
        </span>
      )}
    </NavLink>
  ));
}
```

- In `Layout`, read the count and pass it to both `NavLinks` (desktop + mobile):

```jsx
export default function Layout() {
  const { user, logout } = useAuth();
  const { data: reminders } = useQuery({ queryKey: ['reminders'], queryFn: fetchReminders });
  const reminderCount = reminders?.counts?.total ?? 0;
```

  Then update the two `<NavLinks />` usages to `<NavLinks reminderCount={reminderCount} />` (desktop) and `<NavLinks reminderCount={reminderCount} />` (mobile — keep its existing `onNavigate` if present; the mobile one currently has none, so just pass `reminderCount`).

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- Layout`
Expected: PASS (Contacts, Analytics, Reminders links + the badge test).

- [ ] **Step 6: Run the full frontend suite + build**

Run: `npm test`
Expected: PASS — the prior 62 tests, plus 5 Reminders page tests and the new Layout Reminders/badge tests = **69 total**.

Run: `npm run build`
Expected: build succeeds (no errors).

- [ ] **Step 7: Commit**

```bash
git add src/components/Layout.jsx src/components/Layout.test.jsx src/test/server.js
git commit -m "feat(reminders): sidebar Reminders nav item with count badge

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

- **Spec coverage:** `/reminders` page (Task 1) ✓; grouped Interviews (upcoming/overdue) + Follow-ups (due/upcoming) (Task 1) ✓; amber/sky pills (Task 1) ✓; "Mark done" → `updateContact(id,{followUpDate:null})` + invalidate `['reminders']`/`['contacts']` (Task 1) ✓; soft deep-links to `/interviews` and `/contacts` (Task 1) ✓; loading/empty/error states (Task 1) ✓; `fetchReminders` + `['reminders']` key (Task 1) ✓; sidebar nav item after Dashboard with `Bell` icon + count badge sharing the query (Task 2) ✓; MSW handlers for `GET /reminders` and `PATCH /contacts/:id` (Tasks 1–2) ✓.
- **Type consistency:** the mocked payload (`interviews`/`followUps`/`counts`, item fields) matches the BE plan response and the page reads (`data.interviews.overdue`, `item.application.position`, `contact.followUpDate`, `data.counts.total`); `tone` values `'overdue'`/`'upcoming'` are consistent between `Pill` and its callers.
- **Placeholders:** none — every step has complete code and exact commands.
- **Interactivity note:** follow-up rows are a `<li>` containing a `Link` (name) and a `Button` (mark done) — not a `Link` wrapping a `Button` — to avoid nested interactive elements; interview rows have no inner control, so the whole row is a `Link`.
