# FE Web Analytics + Speed Insights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Vercel Web Analytics (pageviews + 2 custom events) and Speed Insights (Core Web Vitals) on the JobTrail frontend, with route normalization and a user-facing privacy disclosure.

**Architecture:** A single new module `src/observability/analytics.jsx` owns all vendor contact — it exports a `<WebVitals/>` component (mounted in `main.jsx`, deliberately outside the tested component tree) plus a `trackEvent` wrapper so call sites never import the SDK directly. Route normalization is manual because Vercel does not auto-populate `route` for React/Vite, and the two products take it through *different* APIs.

**Tech Stack:** Vite 6, React 18, react-router-dom 6.30.4, `@vercel/analytics`, `@vercel/speed-insights`, Vitest + Testing Library + MSW.

**Spec:** `docs/superpowers/specs/2026-07-21-fe-web-analytics-speed-insights-design.md`
**Branch:** `feat/observability-fe-web-analytics` (already exists, spec committed)

## Global Constraints

- **JS/JSX only.** This codebase has no TypeScript anywhere. Never add `.ts`/`.tsx` files or type annotations.
- **`src/test/setup.js` must not be modified.** It runs MSW with `onUnhandledRequest: 'error'`; any un-mocked network call fails the test. The mount point in Task 2 is chosen specifically to preserve this.
- **Mock the local module, not the vendor SDK,** in page/component tests: `vi.mock('../observability/analytics')`. Precedent for local SDK mocking is `src/observability/sentry.test.js`.
- **Free tier: 50,000 events/month**, shared between pageviews and custom events. Exactly two custom events ship: `ai_analysis_run`, `application_created`. Do not add more.
- **Event names are exact strings** — `ai_analysis_run` and `application_created`. Do not rename, pluralize, or camelCase.
- **No consent gating.** Both products are cookieless; disclosure is via modal, not a blocking banner.
- **Commit after every task.** Do not push; the branch stays local until the user asks.

---

### Task 1: Analytics module

**Files:**
- Modify: `package.json` (via `npm install`)
- Create: `src/observability/analytics.jsx`
- Test: `src/observability/analytics.test.jsx`

**Interfaces:**
- Consumes: nothing (first task)
- Produces:
  - `normalizeRoute(pathname: string) => string`
  - `normalizeAnalyticsUrl(url: string) => string`
  - `trackEvent(name: string, props?: object) => void`
  - `WebVitals` — default-less named React component, `export function WebVitals()`, takes no props

- [ ] **Step 1: Install the two packages**

```bash
cd /Users/angelito/personal/SmartJobSearchCRM/SmartJobSearchCRM-FE
npm install @vercel/analytics @vercel/speed-insights
```

Expected: both added to `dependencies` with `^` ranges, matching existing style.

- [ ] **Step 2: Write the failing test**

Create `src/observability/analytics.test.jsx`:

```jsx
import { afterEach, describe, expect, test, vi } from 'vitest';

const trackMock = vi.fn();
vi.mock('@vercel/analytics', () => ({ track: trackMock }));
vi.mock('@vercel/analytics/react', () => ({ Analytics: () => null }));
vi.mock('@vercel/speed-insights/react', () => ({ SpeedInsights: () => null }));

afterEach(() => {
  trackMock.mockReset();
  vi.resetModules();
});

describe('normalizeRoute', () => {
  test('collapses the /editor/:id document id to a pattern', async () => {
    const { normalizeRoute } = await import('./analytics');
    expect(normalizeRoute('/editor/abc123')).toBe('/editor/[id]');
    expect(normalizeRoute('/editor/6890f0c2e1d4a')).toBe('/editor/[id]');
  });

  test('leaves the bare /editor route alone', async () => {
    const { normalizeRoute } = await import('./analytics');
    expect(normalizeRoute('/editor')).toBe('/editor');
    expect(normalizeRoute('/editor/')).toBe('/editor');
  });

  test('leaves all non-parameterized routes unchanged', async () => {
    const { normalizeRoute } = await import('./analytics');
    for (const p of ['/', '/applications', '/analysis', '/welcome', '/documents']) {
      expect(normalizeRoute(p)).toBe(p);
    }
  });

  test('does not collapse deeper segments under /editor', async () => {
    const { normalizeRoute } = await import('./analytics');
    expect(normalizeRoute('/editor/abc/extra')).toBe('/editor/[id]/extra');
  });
});

describe('normalizeAnalyticsUrl', () => {
  test('rewrites the pathname but preserves origin and query', async () => {
    const { normalizeAnalyticsUrl } = await import('./analytics');
    expect(normalizeAnalyticsUrl('https://jobtrail.app/editor/abc123?x=1'))
      .toBe('https://jobtrail.app/editor/[id]?x=1');
  });

  test('passes through a non-parameterized url', async () => {
    const { normalizeAnalyticsUrl } = await import('./analytics');
    expect(normalizeAnalyticsUrl('https://jobtrail.app/applications'))
      .toBe('https://jobtrail.app/applications');
  });

  test('returns the input unchanged when it is not a parseable url', async () => {
    const { normalizeAnalyticsUrl } = await import('./analytics');
    expect(normalizeAnalyticsUrl('not-a-url')).toBe('not-a-url');
  });
});

describe('trackEvent', () => {
  test('forwards name and props to track', async () => {
    const { trackEvent } = await import('./analytics');
    trackEvent('ai_analysis_run', { ai: true });
    expect(trackMock).toHaveBeenCalledWith('ai_analysis_run', { ai: true });
  });

  test('forwards a bare name with no props', async () => {
    const { trackEvent } = await import('./analytics');
    trackEvent('application_created');
    expect(trackMock).toHaveBeenCalledWith('application_created', undefined);
  });

  test('never throws when the sdk fails', async () => {
    trackMock.mockImplementation(() => { throw new Error('sdk down'); });
    const { trackEvent } = await import('./analytics');
    expect(() => trackEvent('ai_analysis_run')).not.toThrow();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/observability/analytics.test.jsx`
Expected: FAIL — `Failed to resolve import "./analytics"`.

- [ ] **Step 4: Write the implementation**

Create `src/observability/analytics.jsx`:

```jsx
// Central (and only) Vercel Analytics + Speed Insights integration point.
// Mounted from main.jsx as a sibling of <App/> — deliberately outside the
// component tree that Vitest renders, so the MSW setup (onUnhandledRequest:
// 'error') needs no analytics mock. Mirrors the sentry.js module convention.
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { track } from '@vercel/analytics';
import { useLocation } from 'react-router-dom';

// /editor/:id is the only parameterized route in the app (see App.jsx). Vercel
// auto-fills `route` for Next/Nuxt/SvelteKit/Remix but NOT for React/Vite, so
// without this every document id becomes its own dashboard row — unreadable,
// and it burns the 50k/mo free-tier event budget.
function normalizeRoute(pathname) {
  return pathname.replace(/^\/editor\/[^/]+/, '/editor/[id]').replace(/^(.+)\/$/, '$1');
}

// The <Analytics/> React build exposes no `route` prop — URL rewriting goes
// through beforeSend instead. Speed Insights uses `route`. Same normalization,
// two different APIs.
function normalizeAnalyticsUrl(url) {
  try {
    const u = new URL(url);
    u.pathname = normalizeRoute(u.pathname);
    return u.toString();
  } catch {
    return url; // not parseable — send as-is rather than dropping the event
  }
}

// Analytics must never break a user flow, so failures are swallowed.
function trackEvent(name, props) {
  try {
    track(name, props);
  } catch {
    // intentionally ignored
  }
}

function WebVitals() {
  const route = normalizeRoute(useLocation().pathname);
  return (
    <>
      <Analytics beforeSend={(e) => ({ ...e, url: normalizeAnalyticsUrl(e.url) })} />
      <SpeedInsights route={route} />
    </>
  );
}

export { WebVitals, trackEvent, normalizeRoute, normalizeAnalyticsUrl };
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/observability/analytics.test.jsx`
Expected: PASS — 9 tests.

Two failures worth pre-empting:

- **`normalizeRoute('/editor/')`** — the trailing-slash strip must run *after* the `/editor/:id` replace. `/editor/` has an empty id segment that `[^/]+` correctly refuses to match, so the second replace turns it into `/editor`. Confirm both regexes are present and in that order.
- **`normalizeAnalyticsUrl` bracket encoding** — `[` and `]` are not in the WHATWG URL path percent-encode set, so `URL.toString()` should leave `/editor/[id]` literal. If your runtime encodes them as `%5Bid%5D` anyway, do not fight it with `decodeURIComponent` on the whole URL (that would also decode legitimately-encoded query values). Instead build the string manually: `` `${u.origin}${normalizeRoute(u.pathname)}${u.search}` ``.

- [ ] **Step 6: Run the full suite to confirm nothing regressed**

Run: `npm test`
Expected: PASS — no new failures. The new packages are only imported by the new module, which nothing renders yet.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/observability/analytics.jsx src/observability/analytics.test.jsx
git commit -m "feat(observability): add analytics module with route normalization

@vercel/analytics + @vercel/speed-insights behind a local wrapper.
Route normalization is manual — Vercel does not auto-populate \`route\`
for React/Vite — and the two products take it via different APIs:
SpeedInsights uses the \`route\` prop, Analytics uses \`beforeSend\`."
```

---

### Task 2: Mount in main.jsx

**Files:**
- Modify: `src/main.jsx:1-26`

**Interfaces:**
- Consumes: `WebVitals` from `./observability/analytics`
- Produces: nothing — this is the wiring task

- [ ] **Step 1: Add the import**

In `src/main.jsx`, after the existing `chunkReload` import (line 7):

```jsx
import { installChunkReloadHandler } from './observability/chunkReload';
import { WebVitals } from './observability/analytics';
```

- [ ] **Step 2: Render it inside BrowserRouter**

Replace lines 20-22 of `src/main.jsx`:

```jsx
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <App />
        </BrowserRouter>
```

with:

```jsx
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <WebVitals />
          <App />
        </BrowserRouter>
```

It must be **inside** `<BrowserRouter>` because `WebVitals` calls `useLocation()`. It must **not** move into `App.jsx` — that would put the beacon inside the tested component tree and break the MSW setup.

- [ ] **Step 3: Verify the build compiles**

Run: `npm run build`
Expected: succeeds, `dist/` written, no unresolved-import errors.

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: PASS, unchanged count. `main.jsx` has no unit tests, so nothing should move.

- [ ] **Step 5: Commit**

```bash
git add src/main.jsx
git commit -m "feat(observability): mount WebVitals inside BrowserRouter"
```

---

### Task 3: `ai_analysis_run` event

**Files:**
- Modify: `src/pages/Analysis.jsx:51-55` (the `onRun` handler) and its import block
- Test: `src/pages/Analysis.test.jsx` (existing file — add to it)

**Interfaces:**
- Consumes: `trackEvent` from `../observability/analytics`
- Produces: nothing

Fire in the **submit handler**, not `onSuccess` — we want to count analysis *attempts* including failures, since failure volume is the more useful signal given past OpenRouter free-tier flakiness. `onRun` already returns early on validation failure, so it only fires on genuine submits.

Do **not** hook `openHistory` (line 38) or `remove` (line 43) — those are history viewing and deletion, not runs.

- [ ] **Step 1: Write the failing test**

Add to `src/pages/Analysis.test.jsx`. First add the import and the module-level mock at the top of the file, directly after the existing `import Analysis from './Analysis';` line:

```jsx
import Analysis from './Analysis';
import { trackEvent } from '../observability/analytics';

vi.mock('../observability/analytics', () => ({ trackEvent: vi.fn() }));

beforeEach(() => { trackEvent.mockClear(); });
```

(`vi`, `test`, `expect`, and `beforeEach` are globals — `vite.config.js` sets `test.globals: true` — so no vitest import is needed. This matches the file's existing style.)

Then append both tests. They reuse the file's existing `renderPage()` helper, its `REPORT` fixture, and its `a1`/`d1` MSW fixtures:

```jsx
test('fires ai_analysis_run on submit with the ai flag', async () => {
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([{ id: 'a1', position: 'Backend Engineer' }])),
    http.get(`${API}/applications/a1`, () => HttpResponse.json({ id: 'a1', position: 'Backend Engineer', jobDescription: 'Node.js' })),
    http.get(`${API}/documents`, () => HttpResponse.json([{ id: 'd1', name: 'Backend Resume', type: 'Resume', originalFilename: 'r.pdf', mimeType: 'application/pdf', sizeBytes: 1 }])),
    http.get(`${API}/analysis`, () => HttpResponse.json([])),
    http.post(`${API}/analysis`, () => HttpResponse.json({ id: 'an1', atsScore: 82, matchScore: 67, report: REPORT, createdAt: new Date().toISOString() }, { status: 201 })),
  );
  renderPage();
  await waitFor(() => expect(screen.getByRole('option', { name: /Backend Engineer/ })).toBeInTheDocument());
  await userEvent.selectOptions(screen.getByLabelText(/application/i), 'a1');
  await userEvent.selectOptions(screen.getByLabelText(/résumé|resume/i), 'd1');
  await userEvent.click(screen.getByRole('button', { name: /run analysis/i }));

  expect(trackEvent).toHaveBeenCalledWith('ai_analysis_run', { ai: false });
});

test('does not fire ai_analysis_run when validation blocks the submit', async () => {
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([])),
    http.get(`${API}/documents`, () => HttpResponse.json([])),
    http.get(`${API}/analysis`, () => HttpResponse.json([])),
  );
  renderPage();
  await userEvent.click(screen.getByRole('button', { name: /run analysis/i }));

  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/pick an application/i));
  expect(trackEvent).not.toHaveBeenCalled();
});
```

The `ai: false` expectation is correct because the "Use AI analysis" checkbox is disabled unless `getAnalysisConfig` reports `aiAvailable`, and these handlers do not enable it.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/pages/Analysis.test.jsx`
Expected: FAIL — `expected "trackEvent" to be called with...` / number of calls: 0.

- [ ] **Step 3: Add the import**

In `src/pages/Analysis.jsx`, after the `Button` import (line 8):

```jsx
import Button from '../components/Button';
import { trackEvent } from '../observability/analytics';
```

- [ ] **Step 4: Fire the event**

Replace `onRun` (lines 51-55):

```jsx
  function onRun(e) {
    e.preventDefault();
    if (!applicationId || !documentId) { setError('Pick an application and a résumé.'); return; }
    trackEvent('ai_analysis_run', { ai: useAi && aiAvailable });
    run.mutate();
  }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/pages/Analysis.test.jsx`
Expected: PASS, including the pre-existing tests in the file.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Analysis.jsx src/pages/Analysis.test.jsx
git commit -m "feat(observability): track ai_analysis_run on analysis submit

Fires on attempt rather than success so failed analyses are counted."
```

---

### Task 4: `application_created` event

**Files:**
- Modify: `src/components/ApplicationDrawer.jsx:169-173` (the `save` mutation) and its import block
- Test: `src/components/ApplicationDrawer.test.jsx` (existing file — add to it)

**Interfaces:**
- Consumes: `trackEvent` from `../observability/analytics`
- Produces: nothing

**This is the highest-risk task in the plan.** The `save` mutation is create-**and**-update combined, branching on `isEdit` inside `mutationFn` (line 170), and its `onSuccess` takes no arguments. An unguarded `trackEvent` fires on every application *edit* as well as every creation — silently inflating the metric in a way that still looks plausible on the dashboard. The `!isEdit` guard is mandatory, and the negative test below is what proves it.

- [ ] **Step 1: Write the failing tests**

Add to `src/components/ApplicationDrawer.test.jsx`. Add the import and mock at the top, after the existing `import ApplicationDrawer from './ApplicationDrawer';`:

```jsx
import ApplicationDrawer from './ApplicationDrawer';
import { trackEvent } from '../observability/analytics';

vi.mock('../observability/analytics', () => ({ trackEvent: vi.fn() }));
```

Then add `trackEvent.mockClear();` to the **existing** `beforeEach` block (the one that registers the shared MSW handlers) so it clears between tests:

```jsx
beforeEach(() => {
  trackEvent.mockClear();
  server.use(
    // ...existing handlers, unchanged
  );
});
```

Both tests use the file's existing `renderDrawer()` helper and its `app` fixture. The negative test is the point of the task:

```jsx
test('fires application_created when saving a new application', async () => {
  server.use(http.post(`${API}/applications`, () => HttpResponse.json({ ...app, id: 'new1' }, { status: 201 })));
  renderDrawer();

  await userEvent.type(screen.getByLabelText(/position/i), 'Backend Engineer');
  await userEvent.click(screen.getByRole('button', { name: /save/i }));

  await waitFor(() => expect(trackEvent).toHaveBeenCalledWith('application_created'));
});

test('does NOT fire application_created when saving an edit', async () => {
  server.use(http.patch(`${API}/applications/a1`, async ({ request }) => (
    HttpResponse.json({ ...app, ...(await request.json()), company: null })
  )));
  const onClose = vi.fn();
  renderDrawer({ application: app, onClose });

  await waitFor(() => expect(screen.getByLabelText(/position/i)).toHaveValue('Backend Eng'));
  await userEvent.clear(screen.getByLabelText(/position/i));
  await userEvent.type(screen.getByLabelText(/position/i), 'Senior Backend Eng');
  await userEvent.click(screen.getByRole('button', { name: /save/i }));

  // Waiting on onClose proves the save actually completed — without this the
  // "no event" assertion could pass simply because nothing had happened yet.
  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(trackEvent).not.toHaveBeenCalled();
});
```

`renderDrawer()` with no argument passes `application={null}`, which is what makes `isEdit` false — that is the create path.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/ApplicationDrawer.test.jsx`
Expected: the create test FAILS (0 calls). The edit test may *pass* vacuously at this point — that is expected and is exactly why it must be written before the implementation, so it can catch a later unguarded change.

- [ ] **Step 3: Add the import**

In `src/components/ApplicationDrawer.jsx`, add to the existing import block:

```jsx
import { trackEvent } from '../observability/analytics';
```

- [ ] **Step 4: Fire the guarded event**

Replace the `save` mutation (lines 169-173):

```jsx
  const save = useMutation({
    mutationFn: (body) => (isEdit ? updateApplication(application.id, body) : createApplication(body)),
    onSuccess: () => {
      if (!isEdit) trackEvent('application_created'); // guard: this mutation also handles edits
      qc.invalidateQueries({ queryKey: ['applications'] });
      qc.invalidateQueries({ queryKey: ['activity'] });
      onClose();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Could not save')),
  });
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/components/ApplicationDrawer.test.jsx`
Expected: PASS — both new tests plus all pre-existing ones.

- [ ] **Step 6: Sanity-check the guard by temporarily breaking it**

Remove the `if (!isEdit)` guard so the line reads `trackEvent('application_created');`, then run:

Run: `npx vitest run src/components/ApplicationDrawer.test.jsx`
Expected: the **edit** test now FAILS. This proves the negative test has teeth rather than passing vacuously.

Restore the guard and re-run to confirm PASS before committing.

- [ ] **Step 7: Commit**

```bash
git add src/components/ApplicationDrawer.jsx src/components/ApplicationDrawer.test.jsx
git commit -m "feat(observability): track application_created, guarded on !isEdit

The save mutation handles both create and update; without the guard the
event would also fire on every edit and silently inflate the metric."
```

---

### Task 5: Privacy policy modal

**Files:**
- Create: `src/components/PrivacyPolicyModal.jsx`
- Test: `src/components/PrivacyPolicyModal.test.jsx`

**Interfaces:**
- Consumes: nothing
- Produces: `PrivacyPolicyModal` — default export, props `{ open: boolean, onClose: () => void }`, renders `null` when `open` is false

Follow the established dialog pattern from `src/components/ContactDrawer.jsx:104-119`: `if (!open) return null`, a `fixed inset-0 z-40` wrapper, a click-to-close backdrop, `role="dialog"` + `aria-modal="true"` + `aria-label`, Escape-to-close, and a focus trap. This modal is centered rather than a right-hand drawer.

- [ ] **Step 1: Write the failing test**

Create `src/components/PrivacyPolicyModal.test.jsx`:

```jsx
import { expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PrivacyPolicyModal from './PrivacyPolicyModal';

test('renders nothing when closed', () => {
  const { container } = render(<PrivacyPolicyModal open={false} onClose={() => {}} />);
  expect(container).toBeEmptyDOMElement();
});

test('renders the dialog with all three data disclosures when open', () => {
  render(<PrivacyPolicyModal open onClose={() => {}} />);
  const dialog = screen.getByRole('dialog');
  expect(dialog).toHaveAttribute('aria-modal', 'true');
  expect(dialog).toHaveTextContent(/vercel/i);
  expect(dialog).toHaveTextContent(/sentry/i);
  expect(dialog).toHaveTextContent(/openrouter/i);
});

test('closes via the close button', async () => {
  const onClose = vi.fn();
  const user = userEvent.setup();
  render(<PrivacyPolicyModal open onClose={onClose} />);
  await user.click(screen.getByRole('button', { name: /close/i }));
  expect(onClose).toHaveBeenCalled();
});

test('closes on Escape', async () => {
  const onClose = vi.fn();
  const user = userEvent.setup();
  render(<PrivacyPolicyModal open onClose={onClose} />);
  await user.keyboard('{Escape}');
  expect(onClose).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/PrivacyPolicyModal.test.jsx`
Expected: FAIL — `Failed to resolve import "./PrivacyPolicyModal"`.

- [ ] **Step 3: Write the implementation**

Create `src/components/PrivacyPolicyModal.jsx`:

```jsx
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

// Discloses what JobTrail collects. Cookieless analytics needs no consent
// banner, so this is disclosure rather than a gate. Follows the dialog pattern
// used by ContactDrawer/ApplicationDrawer (Escape + focus trap + aria-modal).
export default function PrivacyPolicyModal({ open, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const node = ref.current;
    const getFocusable = () => Array.from(
      node?.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) || [],
    );
    const onKey = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const els = getFocusable();
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    getFocusable()[0]?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} aria-hidden="true" />
      <div className="grid h-full place-items-center p-4">
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-label="Privacy policy"
          className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-y-auto rounded-2xl bg-white shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-sky-100 px-5 py-3">
            <h2 className="text-lg font-bold text-slate-900">Privacy</h2>
            <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 cursor-pointer">
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="space-y-4 px-5 py-4 text-sm text-slate-600">
            <p>
              JobTrail is a portfolio project. It collects the minimum needed to keep the app
              working and to understand how it performs. There are no advertising trackers.
            </p>

            <section>
              <h3 className="mb-1 font-semibold text-slate-900">Usage analytics</h3>
              <p>
                Vercel Web Analytics and Speed Insights record page views and page-load
                performance. Both are cookieless and aggregate — no personal data, no
                cross-site tracking, and no profile is built about you.
              </p>
            </section>

            <section>
              <h3 className="mb-1 font-semibold text-slate-900">Error reporting</h3>
              <p>
                When something breaks, Sentry receives the error and the page it happened on so
                it can be fixed. Authentication headers are stripped before the report is sent,
                and personally identifying data is not attached.
              </p>
            </section>

            <section>
              <h3 className="mb-1 font-semibold text-slate-900">AI features</h3>
              <p>
                If you run an AI résumé analysis, the résumé text and job description are sent to
                OpenRouter for processing. Free models may be served by providers that can use
                inputs for training — review your OpenRouter privacy settings. Analyses that do
                not use AI stay on JobTrail&rsquo;s own servers.
              </p>
            </section>

            <section>
              <h3 className="mb-1 font-semibold text-slate-900">Your data</h3>
              <p>
                Applications, documents, and contacts you create are stored so the app can show
                them back to you. They are not sold or shared.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
```

Note the listener is attached to `document` rather than the dialog node so Escape works before focus lands inside — a small, deliberate divergence from `ContactDrawer`, which attaches to its own node.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/PrivacyPolicyModal.test.jsx`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/PrivacyPolicyModal.jsx src/components/PrivacyPolicyModal.test.jsx
git commit -m "feat(privacy): add privacy policy modal

Discloses Vercel Analytics, Sentry, and the OpenRouter AI hand-off."
```

---

### Task 6: Wire the modal triggers

**Files:**
- Modify: `src/pages/Login.jsx` (import block; card footer after line 68)
- Modify: `src/pages/Landing.jsx` (import block; header button group lines 32-38)
- Test: `src/pages/Login.test.jsx`, `src/pages/Landing.test.jsx` (existing files — add to each)

**Interfaces:**
- Consumes: `PrivacyPolicyModal` from `../components/PrivacyPolicyModal`
- Produces: nothing — final wiring task

- [ ] **Step 1: Write the failing tests**

Both existing test files render the whole `<App/>` at a route rather than the bare page component — follow that, do not render the page directly.

Append to `src/pages/Login.test.jsx`:

```jsx
test('opens the privacy modal from the login footer', async () => {
  renderWithProviders(<App />, { route: '/login' });
  await userEvent.click(await screen.findByRole('button', { name: /^privacy$/i }));
  expect(screen.getByRole('dialog', { name: /privacy policy/i })).toBeInTheDocument();
});
```

Append to `src/pages/Landing.test.jsx`:

```jsx
test('opens the privacy modal from the landing header', async () => {
  renderWithProviders(<App />, { route: '/welcome' });
  await userEvent.click(await screen.findByRole('button', { name: /^privacy$/i }));
  expect(screen.getByRole('dialog', { name: /privacy policy/i })).toBeInTheDocument();
});
```

Both files already import `App`, `renderWithProviders`, `screen`, and `userEvent`, so no new imports are needed. The anchored `/^privacy$/i` matches the trigger button exactly and will not also match text inside the opened dialog.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/pages/Login.test.jsx src/pages/Landing.test.jsx`
Expected: FAIL — `Unable to find an accessible element with the role "button" and name /privacy/i`.

- [ ] **Step 3: Wire Login.jsx**

Add imports after the `Button` import (line 7):

```jsx
import Button from '../components/Button';
import PrivacyPolicyModal from '../components/PrivacyPolicyModal';
```

Add state — inside the component, after the `busy` state (line 17):

```jsx
  const [busy, setBusy] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
```

Replace lines 66-69 (the "No account?" paragraph through the card's closing `</div>`):

```jsx
        <p className="mt-5 text-sm text-slate-600">
          No account? <Link className="font-medium text-sky-700 hover:underline" to="/register">Create one</Link>
        </p>
        <p className="mt-3 text-xs text-slate-400">
          <button type="button" onClick={() => setPrivacyOpen(true)} className="cursor-pointer hover:underline">
            Privacy
          </button>
        </p>
      </div>
      <PrivacyPolicyModal open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
```

- [ ] **Step 4: Wire Landing.jsx**

Add imports after the `Button` import (line 5):

```jsx
import Button from '../components/Button';
import PrivacyPolicyModal from '../components/PrivacyPolicyModal';
```

`Landing` currently has no `useState` import — update line 1 region by adding it:

```jsx
import { useState } from 'react';
```

Add state inside the component, after the `useDemoLogin` call (line 19) and **before** the `if (status === 'authenticated')` early return on line 20, so hook order stays stable:

```jsx
  const { tryDemo, demoBusy, demoError } = useDemoLogin();
  const [privacyOpen, setPrivacyOpen] = useState(false);
  if (status === 'authenticated') return <Navigate to="/" replace />;
```

Replace the header button group (lines 32-38):

```jsx
        <div className="flex items-center gap-2">
          <a href={FE_REPO} target="_blank" rel="noopener noreferrer"
            className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 sm:inline-flex">
            <Github size={16} aria-hidden="true" /> GitHub
          </a>
          <button type="button" onClick={() => setPrivacyOpen(true)}
            className="cursor-pointer rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
            Privacy
          </button>
          <Link to="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Log in</Link>
        </div>
```

Then render the modal just before the component's closing `</div>` (the outer `min-h-dvh` wrapper that opens on line 23):

```jsx
      <PrivacyPolicyModal open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
    </div>
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/pages/Login.test.jsx src/pages/Landing.test.jsx`
Expected: PASS, including all pre-existing tests in both files.

- [ ] **Step 6: Run the full suite and build**

Run: `npm test && npm run build`
Expected: full suite PASS, build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Login.jsx src/pages/Landing.jsx src/pages/Login.test.jsx src/pages/Landing.test.jsx
git commit -m "feat(privacy): open privacy modal from login footer and landing header"
```

---

### Task 7: Documentation

**Files:**
- Modify: `../TASKS.md:76-78` (project root, outside this repo)
- Modify: `../TRACKER.md:6` and the V3-21 entry region (project root, outside this repo)
- Modify: `../docs/learnings/production-observability-101.md` (project root, outside this repo)

**Interfaces:**
- Consumes: nothing
- Produces: nothing

**Note:** all three files live in the project root, which is **not a git repository**. They cannot be committed — edit them and stop. Only the spec and plan (in this FE repo) are version-controlled.

- [ ] **Step 1: Update TASKS.md**

Replace the item at `TASKS.md:76-78`. It currently reads:

```markdown
- **Production observability — FE analytics + P3 (remaining)** ☐ *(PLANNED; P1 shipped as V3-18, P1.5 as V3-19, P2 as V3-20, log drain as V3-21)* **(FE + ops)**:
  - **FE Web Analytics:** **Vercel Web Analytics** (Core Web Vitals) on the frontend.
  - **P3 (optional):** a scheduled synthetic **"golden path" check** (login as demo → run an analysis) to catch deeper breakage the health check misses.
```

Replace with:

```markdown
- **Production observability — P3 (remaining)** ☐ *(P1 shipped as V3-18, P1.5 as V3-19, P2 as V3-20, log drain as V3-21, FE analytics as V3-22)* **(ops)**:
  - **FE Web Analytics + Speed Insights:** ✅ shipped as V3-22 — `@vercel/analytics` (page views + `ai_analysis_run` / `application_created`) and `@vercel/speed-insights` (Core Web Vitals). Note these are two distinct products: Core Web Vitals come from Speed Insights, not Web Analytics.
  - **P3 (optional):** a scheduled synthetic **"golden path" check** (login as demo → run an analysis) to catch deeper breakage the health check misses.
```

- [ ] **Step 2: Update the TRACKER.md current-phase line**

At `TRACKER.md:6`, the line ends with:

> **All of P1 (BE) + P1.5 (FE) + P2 (BE logging) + log drain now live in prod. Next: FE Vercel Web Analytics (Core Web Vitals) + P3 synthetic golden-path check.**

Replace that trailing sentence with:

> **All of P1 (BE) + P1.5 (FE) + P2 (BE logging) + log drain + FE Web Analytics/Speed Insights now live in prod. Next: P3 synthetic golden-path check (optional).**

- [ ] **Step 3: Add the V3-22 tracker entry**

Add a new entry to `TRACKER.md` following the exact format of the existing V3-21 entry (read it first and mirror its heading level, date format, and section structure). Content:

- **V3-22 — FE Web Analytics + Speed Insights** (2026-07-21)
- `@vercel/analytics` and `@vercel/speed-insights` mounted via `src/observability/analytics.jsx`, rendered in `main.jsx` inside `BrowserRouter`
- Manual route normalization (`/editor/:id` → `/editor/[id]`) — Vercel auto-fills `route` for Next/Nuxt/SvelteKit/Remix but not React/Vite; Speed Insights takes it via the `route` prop, Analytics via `beforeSend`
- Two custom events: `ai_analysis_run` (fires on submit, so failures count), `application_created` (guarded on `!isEdit` because the save mutation also handles edits)
- Privacy modal added, reachable from the login footer and landing header
- Free tier: 50k events/month shared across page views and custom events

- [ ] **Step 4: Add the learnings section**

In `../docs/learnings/production-observability-101.md`, add a new section after the P2 structured-logging section (which ends before `## 5. Why JobTrail turns *off* tracing, profiling, metrics` at line 328). Match the existing prose voice — explanatory, gotcha-driven, first-person-plural about JobTrail's choices.

Title it `## Real User Monitoring (JobTrail V3-22)` and cover:

1. **RUM vs. synthetic.** Lighthouse measures one scripted load on one machine; Speed Insights measures real sessions on real devices and networks. A green Lighthouse score and bad field CWV routinely coexist — the field data is what Google actually ranks on.
2. **Web Analytics and Speed Insights are different products.** Traffic vs. Core Web Vitals. JobTrail's own tracker conflated them for four rounds; the parenthetical "(Core Web Vitals)" was attached to the wrong package name.
3. **The framework gap.** Vercel auto-populates `route` for Next.js, Nuxt, SvelteKit, and Remix. For a plain React/Vite SPA it does not, so every dynamic segment becomes its own dashboard row — unreadable, and it burns quota. Worse, the two products expose *different* APIs for the fix: `route` on Speed Insights, `beforeSend` on Analytics.
4. **Ad-blockers eat analytics too.** Same limitation already documented for Sentry in the P1.5 section. Client-side RUM systematically undercounts; treat the numbers as directional, not exact.
5. **Quota shapes instrumentation.** The Hobby tier's 50k events/month is shared between page views and custom events, which is why `application_stage_changed` was dropped — kanban drags are high-volume and low-signal.
6. **Combined create/update mutations are an analytics trap.** `application_created` sits in an `onSuccess` shared by both paths; without the `!isEdit` guard the metric inflates silently and the dashboard still looks plausible. Instrument the *intent*, not the shared callback.

- [ ] **Step 5: Verify no repo files were touched**

Run: `git status --short`
Expected: clean. All Task 7 edits are outside this repository; if anything shows up here, it was edited by mistake.

---

## Verification (after all tasks)

Local:

- [ ] `npm test` — full suite green
- [ ] `npm run build` — clean

Post-deploy (analytics cannot be verified locally — both products only report from a Vercel deployment):

- [ ] Deploy the branch to Vercel
- [ ] Enable Web Analytics and Speed Insights in the Vercel project dashboard if not already on
- [ ] Confirm `/_vercel/insights/*` and `/_vercel/speed-insights/*` beacons fire in the browser Network tab
- [ ] Visit `/editor/<some-id>`; confirm the dashboard shows `/editor/[id]`, **not** the raw ID
- [ ] Run one analysis; confirm `ai_analysis_run` lands
- [ ] Create one application; confirm `application_created` lands
- [ ] **Edit an existing application; confirm NO `application_created` fires** — this is the guard from Task 4
- [ ] Open the privacy modal from both the login footer and the landing header
- [ ] Wait ~24h for Core Web Vitals to accumulate a usable sample
