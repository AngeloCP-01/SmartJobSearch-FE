# Analytics Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated `/analytics` page (sidebar nav after Dashboard) that shows four headline metric cards plus a pipeline bar chart and an applications-over-time area chart, consuming `GET /api/analytics`.

**Architecture:** A new `src/pages/Analytics.jsx` page driven by a single `useQuery(['analytics'])`, a new `src/api/analytics.js` fetcher, a route in `App.jsx`, and a nav item in `Layout.jsx`. Charts use **Recharts** wrapped in `<ResponsiveContainer>`, themed to the DESIGN.md sky/green palette. Read-only — no mutations.

**Tech Stack:** React + Vite, TanStack Query, React Router, Tailwind v4, lucide-react, **recharts** (new), Vitest + RTL + MSW.

## Global Constraints

- **Backend contract** (must match the BE plan exactly): `GET /api/analytics` →
  `{ metrics: { totalApplications, interviewRate, offerRate, rejectionRate }, funnel: [{ status, count }] (9, canonical order), overTime: [{ month, count }] (12, ascending "YYYY-MM") }`. Rates are fractions `0..1`.
- Status order / colors follow DESIGN.md Kanban hues: Draft `slate`, Applied `sky`, HR_Screening `indigo`, Technical_Interview `violet`, Final_Interview `amber`, Offer `green`, Accepted `emerald`, Rejected `red`, Withdrawn `slate`.
- Visual tokens from `DESIGN.md`: cards `rounded-xl border border-sky-100 bg-white shadow-sm p-5`; page bg `sky-50`; primary `sky-700`; muted text `slate-500`; tabular numerals for figures; lucide icons (never emoji).
- Reuse the existing `api/client.js` axios instance (auth header + refresh interceptor) — do not create a new client.
- Query key: `['analytics']`. `useQuery` only (no mutations, no optimistic updates).
- Tests use the existing harness: `src/test/server.js` (`server`, `API`), MSW `server.use(...)` per test, `onUnhandledRequest: 'error'`.
- Built per `DESIGN.md` (ui-ux-pro-max). Match the existing Dashboard card look.
- Commit trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Recharts dependency + API module + Analytics page (metrics, states) + route + nav

Ships a working `/analytics` page with the four metric cards and loading/empty/error states (charts come in Task 2), plus the route and sidebar link.

**Files:**
- Modify: `package.json` (add `recharts`)
- Create: `src/api/analytics.js`
- Create: `src/pages/Analytics.jsx`
- Create: `src/pages/Analytics.test.jsx`
- Modify: `src/App.jsx` (route)
- Modify: `src/components/Layout.jsx` (nav item)
- Modify: `src/components/Layout.test.jsx` (nav test)

**Interfaces:**
- Produces: `fetchAnalytics() → Promise<AnalyticsPayload>` (the contract above); default-exported `<Analytics />` page component.
- Consumes: `api` from `src/api/client.js`; `useQuery` from `@tanstack/react-query`.

- [ ] **Step 1: Install recharts**

```bash
npm install recharts
```
Expected: `recharts` added to `package.json` dependencies; lockfile updated.

- [ ] **Step 2: Create the API module**

Create `src/api/analytics.js`:

```js
import api from './client';

export async function fetchAnalytics() {
  const { data } = await api.get('/analytics');
  return data;
}
```

- [ ] **Step 3: Write the failing page tests**

Create `src/pages/Analytics.test.jsx`:

```jsx
import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server, API } from '../test/server';
import Analytics from './Analytics';

const FUNNEL = [
  'Draft', 'Applied', 'HR_Screening', 'Technical_Interview',
  'Final_Interview', 'Offer', 'Accepted', 'Rejected', 'Withdrawn',
].map((status) => ({ status, count: 0 }));
const OVERTIME = Array.from({ length: 12 }, (_, i) => ({
  month: `2026-${String(i + 1).padStart(2, '0')}`, count: 0,
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><Analytics /></QueryClientProvider>);
}

test('renders headline metrics from the analytics payload', async () => {
  server.use(http.get(`${API}/analytics`, () => HttpResponse.json({
    metrics: { totalApplications: 42, interviewRate: 0.45, offerRate: 0.07, rejectionRate: 0.19 },
    funnel: FUNNEL, overTime: OVERTIME,
  })));
  renderPage();
  await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument());
  expect(screen.getByText('45%')).toBeInTheDocument();
  expect(screen.getByText('7%')).toBeInTheDocument();
  expect(screen.getByText('19%')).toBeInTheDocument();
});

test('shows a loading state while fetching', () => {
  server.use(http.get(`${API}/analytics`, () => HttpResponse.json({
    metrics: { totalApplications: 0, interviewRate: 0, offerRate: 0, rejectionRate: 0 },
    funnel: FUNNEL, overTime: OVERTIME,
  })));
  renderPage();
  expect(screen.getByText('Loading…')).toBeInTheDocument();
});

test('shows an empty state when there are no applications', async () => {
  server.use(http.get(`${API}/analytics`, () => HttpResponse.json({
    metrics: { totalApplications: 0, interviewRate: 0, offerRate: 0, rejectionRate: 0 },
    funnel: FUNNEL, overTime: OVERTIME,
  })));
  renderPage();
  await waitFor(() =>
    expect(screen.getByText(/add applications to see analytics/i)).toBeInTheDocument());
});

test('shows an error state when the request fails', async () => {
  server.use(http.get(`${API}/analytics`, () =>
    HttpResponse.json({ error: { message: 'boom', code: 'SERVER_ERROR' } }, { status: 500 })));
  renderPage();
  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npm test -- Analytics`
Expected: FAIL — `Failed to resolve import './Analytics'` (page not created yet).

- [ ] **Step 5: Implement the Analytics page (metrics + states, no charts yet)**

Create `src/pages/Analytics.jsx`:

```jsx
import { useQuery } from '@tanstack/react-query';
import { Briefcase, Percent, Award, XCircle } from 'lucide-react';
import { fetchAnalytics } from '../api/analytics';

const pct = (r) => `${Math.round(r * 100)}%`;

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

function Metric({ title, icon, value }) {
  return (
    <Card title={title} icon={icon}>
      <div className="text-4xl font-bold tabular-nums text-slate-900">{value}</div>
    </Card>
  );
}

export default function Analytics() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['analytics'],
    queryFn: fetchAnalytics,
  });

  return (
    <div>
      <h1 className="mb-5 text-2xl font-bold text-slate-900">Analytics</h1>

      {isLoading && <p className="text-slate-500">Loading…</p>}

      {isError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Couldn’t load analytics. Please try again.
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric title="Total applications" icon={Briefcase} value={data.metrics.totalApplications} />
            <Metric title="Interview rate" icon={Percent} value={pct(data.metrics.interviewRate)} />
            <Metric title="Offer rate" icon={Award} value={pct(data.metrics.offerRate)} />
            <Metric title="Rejection rate" icon={XCircle} value={pct(data.metrics.rejectionRate)} />
          </div>

          {data.metrics.totalApplications === 0 && (
            <p className="mt-6 text-slate-500">Add applications to see analytics.</p>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Add the route**

Modify `src/App.jsx` — import the page and add the route inside the protected `<Layout />` group:

```jsx
import Analytics from './pages/Analytics';
```
```jsx
<Route path="/analytics" element={<Analytics />} />
```
Place the route line directly after the `/` (Dashboard) route.

- [ ] **Step 7: Add the sidebar nav item**

Modify `src/components/Layout.jsx`:
- Add `LineChart` to the lucide import:
```jsx
import { LayoutDashboard, LineChart, KanbanSquare, Building2, Users, CalendarClock, LogOut, Briefcase } from 'lucide-react';
```
- Insert the Analytics entry into `NAV` immediately after Dashboard:
```jsx
const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/analytics', label: 'Analytics', icon: LineChart },
  { to: '/applications', label: 'Applications', icon: KanbanSquare },
  { to: '/companies', label: 'Companies', icon: Building2 },
  { to: '/contacts', label: 'Contacts', icon: Users },
  { to: '/interviews', label: 'Interviews', icon: CalendarClock },
];
```

- [ ] **Step 8: Add the nav-link test (append to `src/components/Layout.test.jsx`)**

```jsx
test('renders an Analytics nav link', () => {
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Layout />
      </MemoryRouter>
    </AuthProvider>,
  );
  const links = screen.getAllByRole('link', { name: /analytics/i });
  expect(links.length).toBeGreaterThan(0);
});
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `npm test -- Analytics Layout`
Expected: PASS (4 Analytics page tests + the Layout nav test, plus the existing Contacts nav test).

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json src/api/analytics.js src/pages/Analytics.jsx src/pages/Analytics.test.jsx src/App.jsx src/components/Layout.jsx src/components/Layout.test.jsx
git commit -m "feat(analytics): /analytics page with metric cards, route, and nav

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Pipeline bar chart + applications-over-time area chart

Adds the two Recharts charts (rendered only when there is data), themed to DESIGN.md.

**Files:**
- Modify: `src/pages/Analytics.jsx`
- Modify: `src/pages/Analytics.test.jsx` (append)
- Modify: `src/test/setup.js` (ResizeObserver stub for jsdom)

**Interfaces:**
- Consumes: the `data.funnel` / `data.overTime` arrays from the existing query.
- Produces: two chart cards titled "Pipeline" and "Applications over time", shown only when `totalApplications > 0`.

- [ ] **Step 1: Add a ResizeObserver stub for jsdom (Recharts `<ResponsiveContainer>` needs it)**

Append to `src/test/setup.js`:

```js
// Recharts' ResponsiveContainer relies on ResizeObserver, absent in jsdom.
class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = global.ResizeObserver || ResizeObserver;
```

- [ ] **Step 2: Write the failing chart tests (append to `src/pages/Analytics.test.jsx`)**

```jsx
test('renders the pipeline and over-time chart cards when there is data', async () => {
  server.use(http.get(`${API}/analytics`, () => HttpResponse.json({
    metrics: { totalApplications: 42, interviewRate: 0.45, offerRate: 0.07, rejectionRate: 0.19 },
    funnel: FUNNEL.map((f, i) => ({ ...f, count: i })),
    overTime: OVERTIME.map((b, i) => ({ ...b, count: i })),
  })));
  renderPage();
  await waitFor(() => expect(screen.getByText('Pipeline')).toBeInTheDocument());
  expect(screen.getByText('Applications over time')).toBeInTheDocument();
});

test('hides the charts in the empty state', async () => {
  server.use(http.get(`${API}/analytics`, () => HttpResponse.json({
    metrics: { totalApplications: 0, interviewRate: 0, offerRate: 0, rejectionRate: 0 },
    funnel: FUNNEL, overTime: OVERTIME,
  })));
  renderPage();
  await waitFor(() =>
    expect(screen.getByText(/add applications to see analytics/i)).toBeInTheDocument());
  expect(screen.queryByText('Pipeline')).not.toBeInTheDocument();
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test -- Analytics -t "chart cards"`
Expected: FAIL — no "Pipeline" / "Applications over time" text yet.

- [ ] **Step 4: Implement the charts**

Update `src/pages/Analytics.jsx`. Extend the imports:

```jsx
import { useQuery } from '@tanstack/react-query';
import { Briefcase, Percent, Award, XCircle, BarChart3, TrendingUp } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, CartesianGrid,
  AreaChart, Area,
} from 'recharts';
import { fetchAnalytics } from '../api/analytics';
```

Add the helpers below `pct`:

```jsx
const prettify = (s) => s.replace(/_/g, ' ');

const STATUS_COLORS = {
  Draft: '#94a3b8',               // slate-400
  Applied: '#0ea5e9',             // sky-500
  HR_Screening: '#6366f1',        // indigo-500
  Technical_Interview: '#8b5cf6', // violet-500
  Final_Interview: '#f59e0b',     // amber-500
  Offer: '#16a34a',               // green-600
  Accepted: '#10b981',            // emerald-500
  Rejected: '#dc2626',            // red-600
  Withdrawn: '#94a3b8',           // slate-400
};
```

Replace the empty-state block inside `{data && (...)}` so charts render when there is data:

```jsx
          {data.metrics.totalApplications === 0 ? (
            <p className="mt-6 text-slate-500">Add applications to see analytics.</p>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card title="Pipeline" icon={BarChart3}>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={data.funnel.map((f) => ({ ...f, label: prettify(f.status) }))}
                      margin={{ left: 24, right: 12, top: 4, bottom: 4 }}
                    >
                      <CartesianGrid horizontal={false} stroke="#e0f2fe" />
                      <XAxis type="number" allowDecimals={false} stroke="#64748b" fontSize={12} />
                      <YAxis type="category" dataKey="label" width={120} stroke="#64748b" fontSize={12} />
                      <Tooltip />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                        {data.funnel.map((f) => (
                          <Cell key={f.status} fill={STATUS_COLORS[f.status]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card title="Applications over time" icon={TrendingUp}>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.overTime} margin={{ left: 0, right: 12, top: 4, bottom: 4 }}>
                      <CartesianGrid stroke="#e0f2fe" />
                      <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                      <YAxis allowDecimals={false} stroke="#64748b" fontSize={12} />
                      <Tooltip />
                      <Area type="monotone" dataKey="count" stroke="#0369a1" fill="#bae6fd" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          )}
```

> Note: in jsdom the chart container measures 0×0, so Recharts renders no SVG geometry — that's fine; the tests assert on the card titles (rendered outside `<ResponsiveContainer>`), per the spec ("not on SVG internals"). The ResizeObserver stub from Step 1 prevents a crash.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- Analytics`
Expected: PASS (all 6 Analytics tests).

- [ ] **Step 6: Run the full frontend suite + build**

Run: `npm test`
Expected: PASS — the prior 55 tests plus 6 new Analytics tests + 1 Layout nav test (62 total).

Run: `npm run build`
Expected: build succeeds (Vite production build, no errors).

- [ ] **Step 7: Commit**

```bash
git add src/pages/Analytics.jsx src/pages/Analytics.test.jsx src/test/setup.js
git commit -m "feat(analytics): pipeline bar chart + applications-over-time area chart

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

- **Spec coverage:** Recharts chosen ✓; dedicated `/analytics` page ✓; sidebar item after Dashboard with `LineChart` icon (Task 1) ✓; four metric cards with rates as `%` (Task 1) ✓; pipeline bar chart colored per status + applications-over-time area chart (Task 2) ✓; loading/empty/error states (Task 1) ✓; `fetchAnalytics()` + `['analytics']` key (Task 1) ✓; MSW handler matching the exact contract incl. enum values (Tasks 1–2) ✓; charts assert on accessible titles, not SVG internals ✓.
- **Type consistency:** the mocked payload shape (`metrics`/`funnel`/`overTime`) matches the BE plan's response and the page's reads (`data.metrics.*`, `data.funnel`, `data.overTime`) across both tasks; `pct` formats fractions; `STATUS_COLORS` keys match the backend status enum exactly.
- **Placeholders:** none — every step has complete code and exact commands.
- **Dependency note:** `recharts` is the only new dependency; everything else reuses existing infra (`api/client.js`, MSW server, Card pattern).
