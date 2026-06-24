# Résumé Analysis LLM Layer (OpenRouter) — Frontend Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Use AI" opt-in toggle (disabled without a key) + consent line to the `/analysis` page, send `useAi`, and show an AI badge / fallback note on the report.

**Architecture:** `src/api/analysis.js` gains `getAnalysisConfig()` and a `useAi` arg on `runAnalysis`; the Analysis page reads `GET /analysis/config` to enable the toggle and passes `useAi` + `aiRequested`; `AnalysisReport` renders an AI badge from `meta.aiUsed` and a fallback note when AI was requested but not used.

**Tech Stack:** React + Vite, TanStack Query, Tailwind v4, lucide-react, Vitest + RTL + MSW. No new deps.

## Global Constraints

- **Backend contract:** `GET /analysis/config → { aiAvailable: boolean }`. `POST /analysis` body gains optional `useAi`. Report `meta` gains `aiUsed: boolean` and `aiModel: string|null`; `suggestions[].source` may be `'ai'`.
- Toggle **off by default**, **disabled** when `aiAvailable === false` (hint to set a key). Consent line shown only when the toggle is checked.
- Honest consent copy (verbatim): *"AI analysis sends your résumé text and the job description to OpenRouter. Free models may be served by providers that can use inputs for training — review your OpenRouter privacy settings."*
- Query keys: `['analysisConfig']` for the capability query (existing `['analyses']`/`['analysis',id]` unchanged).
- Tests use the existing harness (`src/test/server.js`, MSW). Commit trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: AI badge + fallback note in `AnalysisReport`

**Files:**
- Modify: `src/components/AnalysisReport.jsx`
- Modify: `src/components/AnalysisReport.test.jsx`

**Interfaces:**
- Produces: `<AnalysisReport report atsScore matchScore aiRequested />` — `aiRequested` (boolean, default false) controls the fallback note.

- [ ] **Step 1: Write the failing tests (append to `src/components/AnalysisReport.test.jsx`)**

```jsx
test('shows an AI badge when the report was AI-assisted', () => {
  render(<AnalysisReport report={{ ...REPORT, meta: { ...REPORT.meta, aiUsed: true, aiModel: 'test/model:free' } }} atsScore={82} matchScore={67} aiRequested />);
  expect(screen.getByText(/AI-assisted match/i)).toBeInTheDocument();
});

test('shows a fallback note when AI was requested but not used', () => {
  render(<AnalysisReport report={{ ...REPORT, meta: { ...REPORT.meta, aiUsed: false } }} atsScore={82} matchScore={67} aiRequested />);
  expect(screen.getByText(/AI was unavailable/i)).toBeInTheDocument();
});

test('no AI badge or fallback note for a plain deterministic report', () => {
  render(<AnalysisReport report={{ ...REPORT, meta: { ...REPORT.meta, aiUsed: false } }} atsScore={82} matchScore={67} />);
  expect(screen.queryByText(/AI-assisted match/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/AI was unavailable/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- AnalysisReport`
Expected: FAIL — no AI-assisted / unavailable text rendered.

- [ ] **Step 3: Implement the badge + note**

In `src/components/AnalysisReport.jsx`:
- Extend the lucide import to add `Sparkles`:

```jsx
import { AlertTriangle, Sparkles } from 'lucide-react';
```
- Change the signature to accept `aiRequested`:

```jsx
export default function AnalysisReport({ report, atsScore, matchScore, aiRequested = false }) {
```
- Immediately **after** the `Guidance only — not a guaranteed ATS pass.` paragraph, add:

```jsx
      {meta?.aiUsed && (
        <p className="flex items-center justify-center gap-1 text-center text-xs text-sky-600">
          <Sparkles size={12} aria-hidden="true" /> AI-assisted match{meta.aiModel ? ` · ${meta.aiModel}` : ''}
        </p>
      )}
      {aiRequested && meta?.aiUsed === false && (
        <p className="text-center text-xs text-amber-700">AI was unavailable — showing keyword-based match.</p>
      )}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- AnalysisReport`
Expected: PASS (the 3 existing + 3 new = 6).

- [ ] **Step 5: Commit**

```bash
git add src/components/AnalysisReport.jsx src/components/AnalysisReport.test.jsx
git commit -m "feat(analysis): AI badge + fallback note in AnalysisReport

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: API + Use-AI toggle on the Analysis page

**Files:**
- Modify: `src/api/analysis.js`
- Modify: `src/pages/Analysis.jsx`
- Modify: `src/pages/Analysis.test.jsx`
- Modify: `src/test/server.js` (default `GET /analysis/config` handler)

**Interfaces:**
- Consumes: `getAnalysisConfig()`, `runAnalysis({…, useAi})` (this task), `AnalysisReport` `aiRequested` prop (Task 1).

- [ ] **Step 1: Extend the API module**

In `src/api/analysis.js`, change `runAnalysis` and add `getAnalysisConfig`:

```js
export async function runAnalysis({ applicationId, documentId, useAi }) {
  const { data } = await api.post('/analysis', { applicationId, documentId, useAi });
  return data;
}
export async function getAnalysisConfig() {
  const { data } = await api.get('/analysis/config');
  return data;
}
```

- [ ] **Step 2: Add a default config handler**

In `src/test/server.js`, add to the `handlers` array:

```js
  http.get(`${API}/analysis/config`, () => HttpResponse.json({ aiAvailable: false })),
```

- [ ] **Step 3: Write the failing page tests (append to `src/pages/Analysis.test.jsx`)**

```jsx
test('AI toggle is disabled when the server has no key', async () => {
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([])),
    http.get(`${API}/documents`, () => HttpResponse.json([])),
    http.get(`${API}/analysis`, () => HttpResponse.json([])),
    http.get(`${API}/analysis/config`, () => HttpResponse.json({ aiAvailable: false })),
  );
  renderPage();
  await waitFor(() => expect(screen.getByLabelText(/use ai/i)).toBeDisabled());
});

test('with AI available, checking the toggle posts useAi:true and shows the AI badge', async () => {
  let postedUseAi = null;
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([{ id: 'a1', position: 'Backend Engineer' }])),
    http.get(`${API}/applications/a1`, () => HttpResponse.json({ id: 'a1', position: 'Backend Engineer', jobDescription: 'Rust' })),
    http.get(`${API}/documents`, () => HttpResponse.json([{ id: 'd1', name: 'Backend Resume', type: 'Resume', originalFilename: 'r.pdf', mimeType: 'application/pdf', sizeBytes: 1 }])),
    http.get(`${API}/analysis`, () => HttpResponse.json([])),
    http.get(`${API}/analysis/config`, () => HttpResponse.json({ aiAvailable: true })),
    http.post(`${API}/analysis`, async ({ request }) => {
      postedUseAi = (await request.json()).useAi;
      return HttpResponse.json({ id: 'an1', atsScore: 82, matchScore: 70,
        report: { ...REPORT, meta: { ...REPORT.meta, aiUsed: true, aiModel: 'test/model:free' } }, createdAt: new Date().toISOString() }, { status: 201 });
    }),
  );
  renderPage();
  await waitFor(() => expect(screen.getByLabelText(/use ai/i)).toBeEnabled());
  await userEvent.selectOptions(screen.getByLabelText(/application/i), 'a1');
  await userEvent.selectOptions(screen.getByLabelText(/résumé|resume/i), 'd1');
  await userEvent.click(screen.getByLabelText(/use ai/i));
  expect(screen.getByText(/sends your résumé text/i)).toBeInTheDocument(); // consent line
  await userEvent.click(screen.getByRole('button', { name: /run analysis/i }));
  await waitFor(() => expect(postedUseAi).toBe(true));
  await waitFor(() => expect(screen.getByText(/AI-assisted match/i)).toBeInTheDocument());
});
```

> Note: `REPORT`, `renderPage` already exist in `Analysis.test.jsx` from V3-3. The `REPORT` fixture's `meta` may lack `aiUsed`; spreading `{ ...REPORT.meta, aiUsed: true }` covers it.

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npm test -- Analysis`
Expected: FAIL — no "Use AI" control / consent line / AI badge yet.

- [ ] **Step 5: Wire the toggle into the page**

In `src/pages/Analysis.jsx`:
- Extend the api import and add the config import:

```jsx
import { runAnalysis, listAnalyses, getAnalysis, deleteAnalysis, getAnalysisConfig } from '../api/analysis';
```
- Add state + the config query (after the existing queries):

```jsx
  const [useAi, setUseAi] = useState(false);
  const { data: aiConfig } = useQuery({ queryKey: ['analysisConfig'], queryFn: getAnalysisConfig });
  const aiAvailable = Boolean(aiConfig?.aiAvailable);
```
- Update the `run` mutation to send `useAi` and record `aiRequested`:

```jsx
  const run = useMutation({
    mutationFn: () => runAnalysis({ applicationId, documentId, useAi: useAi && aiAvailable }),
    onSuccess: (data) => { setCurrent({ ...data, aiRequested: useAi && aiAvailable }); setError(null); qc.invalidateQueries({ queryKey: ['analyses'] }); },
    onError: (e) => setError(e.response?.data?.error?.message || 'Analysis failed'),
  });
```
- In `openHistory`'s `onSuccess`, record `aiRequested: false` (history doesn't know the original request):

```jsx
    onSuccess: (data) => { setCurrent({ ...data, aiRequested: false }); setError(null); },
```
- In the run `<form>`, add the toggle + consent right **after** the pickers' flex row's closing `</div>` (the one holding the selects + Run button) and before the `{noJd && …}` line:

```jsx
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" aria-label="Use AI" checked={useAi} disabled={!aiAvailable}
            onChange={(e) => setUseAi(e.target.checked)} className="h-4 w-4" />
          Use AI analysis
          {!aiAvailable && <span className="text-xs text-slate-400">(set an OpenRouter API key to enable)</span>}
        </label>
        {useAi && aiAvailable && (
          <p className="mt-1 text-xs text-slate-400">
            AI analysis sends your résumé text and the job description to OpenRouter. Free models may be served by providers that can use inputs for training — review your OpenRouter privacy settings.
          </p>
        )}
```
- Pass `aiRequested` to the report:

```jsx
      {current && <AnalysisReport report={current.report} atsScore={current.atsScore} matchScore={current.matchScore} aiRequested={current.aiRequested} />}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test -- Analysis AnalysisReport`
Expected: PASS (existing Analysis tests + the 2 new; AnalysisReport from Task 1).

- [ ] **Step 7: Run the full frontend suite + build**

Run: `npm test`
Expected: PASS — prior 101 + 3 AnalysisReport + 2 Analysis page = **106 total**.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/api/analysis.js src/pages/Analysis.jsx src/pages/Analysis.test.jsx src/test/server.js
git commit -m "feat(analysis): Use-AI toggle + consent + config capability on /analysis

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

- **Spec coverage:** AI badge from `meta.aiUsed` + fallback note (Task 1) ✓; `getAnalysisConfig` + `useAi` on `runAnalysis` (Task 2) ✓; toggle off-by-default + disabled without key + hint (Task 2) ✓; consent line verbatim when checked (Task 2) ✓; `aiRequested` passed to the report so the fallback note only shows on a requested-but-failed run (Tasks 1–2) ✓; default MSW config handler so existing tests don't error (Task 2) ✓.
- **Type consistency:** `runAnalysis({applicationId,documentId,useAi})` and `getAnalysisConfig() → {aiAvailable}` match the BE contract; `aiRequested` prop name consistent between page and `AnalysisReport`; `meta.aiUsed`/`aiModel` read exactly as the BE emits.
- **Placeholders:** none — every step has complete code and exact commands.
