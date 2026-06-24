# Résumé Analysis (ATS) Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/analysis` page where the user picks an application + a résumé, runs an analysis, and sees a rich report (two headline scores, ATS sub-scores, matched/missing keywords, prioritized suggestions), plus a history list of past analyses.

**Architecture:** `src/api/analysis.js` (run/list/get/delete), reusable `ScoreBadge` + `AnalysisReport` components, and `src/pages/Analysis.jsx` (run panel + report + history) via TanStack Query. No new dependencies.

**Tech Stack:** React + Vite, TanStack Query, React Router, Tailwind v4, lucide-react, Vitest + RTL + MSW.

## Global Constraints

- **Backend contract:** `POST /analysis { applicationId, documentId }` → `{ id, atsScore, matchScore, report, createdAt }`; `matchScore` is `null` when the application had no job description. `report` = `{ meta {documentName, position, jdPresent, extractionOk, wordCount}, atsSubScores {parseability, sections, contactInfo, formatting, length}, matched[], missing[], sectionFindings[], suggestions[] }`; `matched`/`missing` entries `{ term, type:'hard'|'soft', jdCount, resumeCount, weight }`; `suggestions` `{ text, severity:'high'|'medium'|'low', source }`. `GET /analysis` → slim list `{ id, atsScore, matchScore, documentName, position, createdAt }`. `GET /analysis/:id` → full row (with `report`). `DELETE /analysis/:id` → 204.
- Pickers use existing `listApplications()` (`src/api/applications.js`) and `listDocuments()` (`src/api/documents.js`).
- Query keys `['analyses']` (list) + `['analysis', id]`; `runAnalysis` success invalidates `['analyses']`.
- **Honest copy:** present scores as guidance — never claim a guaranteed ATS pass.
- Visual tokens per `DESIGN.md`: cards `rounded-xl border border-sky-100 bg-white shadow-sm`; score color bands green ≥75 / amber ≥50 / red <50; hard-skill chips emphasized; severity colors high=amber/red, medium=sky, low=slate; lucide icons; visible focus rings; reuse `src/components/Button.jsx`.
- Tests use the existing harness: `src/test/server.js` (`server`, `API`), MSW `server.use(...)` per test, `onUnhandledRequest:'error'`.
- Built per `DESIGN.md` (ui-ux-pro-max). Commit trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: API module + score/report components

**Files:**
- Create: `src/api/analysis.js`
- Create: `src/components/ScoreBadge.jsx`
- Create: `src/components/AnalysisReport.jsx`
- Create: `src/components/AnalysisReport.test.jsx`

**Interfaces:**
- Produces: `runAnalysis({applicationId, documentId})`, `listAnalyses()`, `getAnalysis(id)`, `deleteAnalysis(id)`; `<ScoreBadge label value />` (value may be `null` → "N/A"); `<AnalysisReport report />`.

- [ ] **Step 1: Create the API module**

Create `src/api/analysis.js`:

```js
import api from './client';

export async function runAnalysis({ applicationId, documentId }) {
  const { data } = await api.post('/analysis', { applicationId, documentId });
  return data;
}
export async function listAnalyses() {
  const { data } = await api.get('/analysis');
  return data;
}
export async function getAnalysis(id) {
  const { data } = await api.get(`/analysis/${id}`);
  return data;
}
export async function deleteAnalysis(id) {
  await api.delete(`/analysis/${id}`);
}
```

- [ ] **Step 2: Write the failing component test**

Create `src/components/AnalysisReport.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react';
import AnalysisReport from './AnalysisReport';

const REPORT = {
  meta: { documentName: 'Backend Resume', position: 'Backend Engineer', jdPresent: true, extractionOk: true, wordCount: 600 },
  atsSubScores: { parseability: 90, sections: 80, contactInfo: 100, formatting: 70, length: 100 },
  matched: [{ term: 'node.js', type: 'hard', jdCount: 4, resumeCount: 3, weight: 8 }],
  missing: [{ term: 'kubernetes', type: 'hard', jdCount: 3, resumeCount: 0, weight: 6 }],
  sectionFindings: [{ section: 'Skills', present: true }],
  suggestions: [{ text: 'Add "Kubernetes" — it appears 3× in the job description.', severity: 'high', source: 'rule' }],
};

test('renders both scores, matched/missing keywords and suggestions', () => {
  render(<AnalysisReport report={REPORT} atsScore={82} matchScore={67} />);
  expect(screen.getByLabelText(/ATS-friendliness score/i)).toHaveTextContent('82');
  expect(screen.getByLabelText(/Match score/i)).toHaveTextContent('67');
  expect(screen.getByText('node.js')).toBeInTheDocument();
  expect(screen.getByText('kubernetes')).toBeInTheDocument();
  expect(screen.getByText(/Add "Kubernetes"/)).toBeInTheDocument();
});

test('shows N/A match score and no-JD note when matchScore is null', () => {
  render(<AnalysisReport report={{ ...REPORT, meta: { ...REPORT.meta, jdPresent: false }, matched: [], missing: [] }} atsScore={82} matchScore={null} />);
  expect(screen.getByLabelText(/Match score/i)).toHaveTextContent(/N\/A/i);
});

test('shows a parseability warning when extraction failed', () => {
  render(<AnalysisReport report={{ ...REPORT, meta: { ...REPORT.meta, extractionOk: false } }} atsScore={10} matchScore={null} />);
  expect(screen.getByRole('alert')).toHaveTextContent(/could not read|image-based|parse/i);
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- AnalysisReport`
Expected: FAIL — `Failed to resolve import './AnalysisReport'`.

- [ ] **Step 4: Implement `ScoreBadge`**

Create `src/components/ScoreBadge.jsx`:

```jsx
function band(value) {
  if (value == null) return 'bg-slate-100 text-slate-500';
  if (value >= 75) return 'bg-emerald-100 text-emerald-800';
  if (value >= 50) return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-700';
}

export default function ScoreBadge({ label, value }) {
  return (
    <div className="flex flex-col items-center">
      <div
        aria-label={`${label}: ${value == null ? 'N/A' : value}`}
        className={`grid h-20 w-20 place-items-center rounded-full text-2xl font-bold ${band(value)}`}
      >
        {value == null ? 'N/A' : value}
      </div>
      <span className="mt-1 text-xs font-medium text-slate-500">{label}</span>
    </div>
  );
}
```

- [ ] **Step 5: Implement `AnalysisReport`**

Create `src/components/AnalysisReport.jsx`:

```jsx
import { AlertTriangle } from 'lucide-react';
import ScoreBadge from './ScoreBadge';

const SUB_LABELS = {
  parseability: 'Parseability', sections: 'Sections', contactInfo: 'Contact', formatting: 'Formatting', length: 'Length',
};
const sevClass = { high: 'bg-amber-100 text-amber-800', medium: 'bg-sky-100 text-sky-800', low: 'bg-slate-100 text-slate-600' };

function Chip({ entry, missing }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium
      ${missing ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'} ${entry.type === 'hard' ? 'ring-1 ring-inset ring-current/20 font-semibold' : ''}`}>
      {entry.term}{missing && entry.jdCount > 1 ? ` ·${entry.jdCount}` : ''}
    </span>
  );
}

export default function AnalysisReport({ report, atsScore, matchScore }) {
  if (!report) return null;
  const { meta, atsSubScores, matched = [], missing = [], suggestions = [] } = report;

  return (
    <div className="space-y-5">
      {meta?.extractionOk === false && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle size={16} aria-hidden="true" />
          We couldn’t read text from this file — it may be image-based or an unsupported format, which an ATS can’t parse.
        </div>
      )}

      <div className="flex items-center justify-center gap-10 rounded-xl border border-sky-100 bg-white p-5 shadow-sm">
        <ScoreBadge label="ATS-friendliness score" value={atsScore} />
        <ScoreBadge label="Match score" value={matchScore} />
      </div>
      <p className="text-center text-xs text-slate-400">Guidance only — not a guaranteed ATS pass.</p>

      <div className="rounded-xl border border-sky-100 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">ATS checks</h3>
        <div className="space-y-2">
          {Object.entries(SUB_LABELS).map(([k, lbl]) => (
            <div key={k} className="flex items-center gap-3">
              <span className="w-24 text-xs text-slate-500">{lbl}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-sky-500" style={{ width: `${atsSubScores?.[k] ?? 0}%` }} />
              </div>
              <span className="w-8 text-right text-xs text-slate-500">{atsSubScores?.[k] ?? 0}</span>
            </div>
          ))}
        </div>
      </div>

      {(matched.length > 0 || missing.length > 0) && (
        <div className="rounded-xl border border-sky-100 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Keywords</h3>
          {matched.length > 0 && (
            <>
              <p className="mb-1 text-xs font-medium text-slate-500">Matched</p>
              <div className="mb-3 flex flex-wrap gap-1.5">{matched.map((e) => <Chip key={e.term} entry={e} />)}</div>
            </>
          )}
          {missing.length > 0 && (
            <>
              <p className="mb-1 text-xs font-medium text-slate-500">Missing from your résumé</p>
              <div className="flex flex-wrap gap-1.5">{missing.map((e) => <Chip key={e.term} entry={e} missing />)}</div>
            </>
          )}
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="rounded-xl border border-sky-100 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Suggestions</h3>
          <ul className="space-y-2">
            {suggestions.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                <span className={`mt-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${sevClass[s.severity]}`}>{s.severity}</span>
                <span>{s.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test -- AnalysisReport`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add src/api/analysis.js src/components/ScoreBadge.jsx src/components/AnalysisReport.jsx src/components/AnalysisReport.test.jsx
git commit -m "feat(analysis): API module + ScoreBadge + AnalysisReport components

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Analysis page + route + nav

**Files:**
- Create: `src/pages/Analysis.jsx`
- Create: `src/pages/Analysis.test.jsx`
- Modify: `src/App.jsx` (route)
- Modify: `src/components/Layout.jsx` (nav item)
- Modify: `src/components/Layout.test.jsx` (nav assertion)
- Modify: `src/test/server.js` (default `GET /analysis` handler)

**Interfaces:**
- Consumes: `runAnalysis`/`listAnalyses`/`getAnalysis`/`deleteAnalysis` (Task 1), `AnalysisReport` (Task 1), `listApplications`, `listDocuments`.

- [ ] **Step 1: Add a default handler so nav/page tests don't error**

In `src/test/server.js`, add to the `handlers` array:

```js
  http.get(`${API}/analysis`, () => HttpResponse.json([])),
```

- [ ] **Step 2: Write the failing page tests**

Create `src/pages/Analysis.test.jsx`:

```jsx
import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { server, API } from '../test/server';
import Analysis from './Analysis';

const REPORT = {
  meta: { documentName: 'Backend Resume', position: 'Backend Engineer', jdPresent: true, extractionOk: true, wordCount: 600 },
  atsSubScores: { parseability: 90, sections: 80, contactInfo: 100, formatting: 70, length: 100 },
  matched: [{ term: 'node.js', type: 'hard', jdCount: 4, resumeCount: 3, weight: 8 }],
  missing: [{ term: 'kubernetes', type: 'hard', jdCount: 3, resumeCount: 0, weight: 6 }],
  sectionFindings: [], suggestions: [{ text: 'Add "Kubernetes".', severity: 'high', source: 'rule' }],
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Analysis />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function baseHandlers() {
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([{ id: 'a1', position: 'Backend Engineer', jobDescription: 'Node.js' }])),
    http.get(`${API}/documents`, () => HttpResponse.json([{ id: 'd1', name: 'Backend Resume', type: 'Resume', originalFilename: 'r.pdf', mimeType: 'application/pdf', sizeBytes: 1 }])),
    http.get(`${API}/analysis`, () => HttpResponse.json([])),
  );
}

test('runs an analysis and renders the report', async () => {
  baseHandlers();
  server.use(http.post(`${API}/analysis`, () => HttpResponse.json({ id: 'an1', atsScore: 82, matchScore: 67, report: REPORT, createdAt: new Date().toISOString() }, { status: 201 })));
  renderPage();
  await waitFor(() => expect(screen.getByRole('option', { name: /Backend Engineer/ })).toBeInTheDocument());
  await userEvent.selectOptions(screen.getByLabelText(/application/i), 'a1');
  await userEvent.selectOptions(screen.getByLabelText(/résumé|resume/i), 'd1');
  await userEvent.click(screen.getByRole('button', { name: /run analysis/i }));
  await waitFor(() => expect(screen.getByLabelText(/ATS-friendliness score/i)).toHaveTextContent('82'));
  expect(screen.getByText('kubernetes')).toBeInTheDocument();
});

test('renders a history list', async () => {
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([])),
    http.get(`${API}/documents`, () => HttpResponse.json([])),
    http.get(`${API}/analysis`, () => HttpResponse.json([
      { id: 'an1', atsScore: 82, matchScore: 67, documentName: 'Backend Resume', position: 'Backend Engineer', createdAt: new Date().toISOString() },
    ])),
  );
  renderPage();
  await waitFor(() => expect(screen.getByText('Backend Resume')).toBeInTheDocument());
});

test('shows an error banner if the run fails', async () => {
  baseHandlers();
  server.use(http.post(`${API}/analysis`, () => HttpResponse.json({ error: { message: 'boom', code: 'X' } }, { status: 500 })));
  renderPage();
  await waitFor(() => expect(screen.getByRole('option', { name: /Backend Engineer/ })).toBeInTheDocument());
  await userEvent.selectOptions(screen.getByLabelText(/application/i), 'a1');
  await userEvent.selectOptions(screen.getByLabelText(/résumé|resume/i), 'd1');
  await userEvent.click(screen.getByRole('button', { name: /run analysis/i }));
  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test -- Analysis`
Expected: FAIL — `Failed to resolve import './Analysis'`.

- [ ] **Step 4: Implement the Analysis page**

Create `src/pages/Analysis.jsx`:

```jsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ScanSearch } from 'lucide-react';
import { listApplications } from '../api/applications';
import { listDocuments } from '../api/documents';
import { runAnalysis, listAnalyses, getAnalysis, deleteAnalysis } from '../api/analysis';
import AnalysisReport from '../components/AnalysisReport';
import Button from '../components/Button';

const selectClass = 'rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500';

export default function Analysis() {
  const qc = useQueryClient();
  const [applicationId, setApplicationId] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [current, setCurrent] = useState(null); // {atsScore, matchScore, report}
  const [error, setError] = useState(null);

  const { data: applications = [] } = useQuery({ queryKey: ['applications'], queryFn: listApplications });
  const { data: documents = [] } = useQuery({ queryKey: ['documents'], queryFn: () => listDocuments() });
  const { data: history = [] } = useQuery({ queryKey: ['analyses'], queryFn: listAnalyses });

  const selectedApp = applications.find((a) => a.id === applicationId);
  const noJd = selectedApp && !selectedApp.jobDescription;

  const run = useMutation({
    mutationFn: () => runAnalysis({ applicationId, documentId }),
    onSuccess: (data) => { setCurrent(data); setError(null); qc.invalidateQueries({ queryKey: ['analyses'] }); },
    onError: (e) => setError(e.response?.data?.error?.message || 'Analysis failed'),
  });
  const openHistory = useMutation({
    mutationFn: (id) => getAnalysis(id),
    onSuccess: (data) => setCurrent(data),
  });
  const remove = useMutation({
    mutationFn: (id) => deleteAnalysis(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['analyses'] }),
  });

  function onRun(e) {
    e.preventDefault();
    if (!applicationId || !documentId) { setError('Pick an application and a résumé.'); return; }
    run.mutate();
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-5 text-2xl font-bold text-slate-900">Résumé Analysis</h1>

      <form className="mb-6 rounded-xl border border-sky-100 bg-white p-4 shadow-sm" onSubmit={onRun}>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col text-sm font-medium text-slate-600">
            Application
            <select aria-label="Application" className={`${selectClass} mt-1`} value={applicationId} onChange={(e) => setApplicationId(e.target.value)}>
              <option value="">Select an application…</option>
              {applications.map((a) => <option key={a.id} value={a.id}>{a.position}</option>)}
            </select>
          </label>
          <label className="flex flex-col text-sm font-medium text-slate-600">
            Résumé
            <select aria-label="Résumé" className={`${selectClass} mt-1`} value={documentId} onChange={(e) => setDocumentId(e.target.value)}>
              <option value="">Select a résumé…</option>
              {documents.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <Button type="submit" disabled={run.isPending}><ScanSearch size={16} aria-hidden="true" /> Run analysis</Button>
        </div>
        {noJd && <p className="mt-2 text-xs text-amber-700">This application has no job description — match scoring needs one; the ATS audit will still run.</p>}
        {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
        {run.isPending && <p className="mt-2 text-sm text-slate-500">Analyzing…</p>}
      </form>

      {current && <AnalysisReport report={current.report} atsScore={current.atsScore} matchScore={current.matchScore} />}

      {history.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Past analyses</h2>
          <ul className="space-y-2">
            {history.map((h) => (
              <li key={h.id} className="flex items-center justify-between rounded-lg border border-sky-100 bg-white px-4 py-2 text-sm shadow-sm">
                <button className="text-left hover:underline" onClick={() => openHistory.mutate(h.id)}>
                  <span className="font-medium text-slate-800">{h.documentName}</span>
                  <span className="text-slate-500"> · {h.position || '—'} · ATS {h.atsScore} · Match {h.matchScore ?? 'N/A'}</span>
                </button>
                <button aria-label={`Delete analysis of ${h.documentName}`} className="text-red-600 cursor-pointer"
                  onClick={() => remove.mutate(h.id)}>Delete</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Add the route**

In `src/App.jsx`, import the page and add the route after `/activity`:

```jsx
import Analysis from './pages/Analysis';
```
```jsx
<Route path="/analysis" element={<Analysis />} />
```

- [ ] **Step 6: Add the nav item**

In `src/components/Layout.jsx`, add `ScanSearch` to the lucide import and insert into `NAV` after Activity:

```jsx
  { to: '/analysis', label: 'Analysis', icon: ScanSearch },
```

- [ ] **Step 7: Add the Layout nav test**

In `src/components/Layout.test.jsx`, add:

```jsx
test('renders an Analysis nav link', () => {
  renderLayout();
  expect(screen.getAllByRole('link', { name: /analysis/i }).length).toBeGreaterThan(0);
});
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npm test -- Analysis Layout`
Expected: PASS (3 Analysis page tests + the Layout suite incl. the new Analysis link).

- [ ] **Step 9: Run the full frontend suite + build**

Run: `npm test`
Expected: PASS — prior 93 tests + (3 AnalysisReport + 3 Analysis page + 1 Layout) = **100 total**.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 10: Commit**

```bash
git add src/pages/Analysis.jsx src/pages/Analysis.test.jsx src/App.jsx src/components/Layout.jsx src/components/Layout.test.jsx src/test/server.js
git commit -m "feat(analysis): /analysis page (run panel + report + history) + nav

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

- **Spec coverage:** `/analysis` page with application + résumé pickers + run (Task 2) ✓; two headline scores via `ScoreBadge` color bands + honest "guidance" copy (Task 1) ✓; ATS sub-score bars + matched/missing chips (hard emphasized, missing shows JD freq) + severity-colored suggestions (Task 1) ✓; parseability warning banner on `extractionOk:false` (Task 1) ✓; no-JD note (Task 2) ✓; history list + open + delete (Task 2) ✓; sidebar nav after Activity (Task 2) ✓; `analysis` API module + query keys + invalidation (Tasks 1–2) ✓; loading/error states (Task 2) ✓; default MSW handler (Task 2) ✓.
- **Type consistency:** the `report` shape and `matched`/`missing` entry fields read by `AnalysisReport` match the BE contract; `ScoreBadge` handles `value==null` → "N/A" consistently for the match score; query keys `['analyses']`/`['analysis', id]` consistent.
- **Placeholders:** none — every step has complete code and exact commands.
