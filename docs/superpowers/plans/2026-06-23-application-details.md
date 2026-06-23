# Application Details (v1.5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the full application data (company, salary, dates, source, job description, notes) and its interviews through a right-side detail/edit drawer, and make the Kanban cards informative.

**Architecture:** One small backend change (include `company` on application responses + allow unlinking), then a self-contained `ApplicationDrawer` React component wired into the existing Kanban board. The drawer owns its form state and mutations; the board controls open/close and which application.

**Tech Stack:** Backend — Express + Prisma + Jest/Supertest. Frontend — React + TanStack Query + @dnd-kit + Vitest/RTL/MSW.

## Global Constraints

- **Two repos:** Task 1 runs in `SmartJobSearchCRM-BE`; Tasks 2–6 run in `SmartJobSearchCRM-FE`. Each task's "Repo" line says which.
- **Backend already accepts** `position, companyId, status, applicationDate, salaryMin, salaryMax, source, jobDescription, notes` on create/update, and enforces `salaryMin ≤ salaryMax`.
- **API base** `/api`; error shape `{ error: { message, code, details? } }`; per-user isolation on every query.
- **Application statuses:** `Draft, Applied, HR_Screening, Technical_Interview, Final_Interview, Offer, Accepted, Rejected, Withdrawn`.
- **Frontend:** access token in memory; all calls via the shared `api` client; tests mock the network with MSW; ES modules; function components.
- **Drawer interface:** `<ApplicationDrawer application={app|null} open onClose />` — `null` application = create mode.
- **TDD** throughout: failing test → minimal impl → passing test → commit.

---

## Task 1: Backend — include company + allow unlinking

**Repo:** `SmartJobSearchCRM-BE`
**Files:**
- Modify: `src/modules/applications/applications.service.js`
- Modify: `src/modules/applications/applications.schema.js`
- Test: `tests/applications.test.js`

**Interfaces:**
- Produces: application responses (`list`, `getById`, `create`, `update`, `updateStatus`) now include `company: { id, name } | null`. `PATCH /applications/:id` with `{ companyId: null }` clears the company. `assertCompany` skips validation for `null`/`undefined`, validates a provided id.

- [ ] **Step 1: Add failing tests to `tests/applications.test.js`**

```js
test('application responses include the linked company {id,name}', async () => {
  const { token } = await registerAndLogin();
  const companyId = await makeCompany(token, 'Acme');
  const created = await agent().post('/api/applications').set(auth(token))
    .send({ position: 'Backend Eng', companyId });
  expect(created.body.company).toMatchObject({ id: companyId, name: 'Acme' });

  const list = await agent().get('/api/applications').set(auth(token));
  expect(list.body[0].company).toMatchObject({ id: companyId, name: 'Acme' });
});

test('an application with no company has company: null', async () => {
  const { token } = await registerAndLogin();
  const created = await agent().post('/api/applications').set(auth(token)).send({ position: 'X' });
  expect(created.body.company).toBeNull();
});

test('PATCH with companyId:null unlinks the company', async () => {
  const { token } = await registerAndLogin();
  const companyId = await makeCompany(token, 'Acme');
  const created = await agent().post('/api/applications').set(auth(token))
    .send({ position: 'X', companyId });
  const res = await agent().patch(`/api/applications/${created.body.id}`).set(auth(token))
    .send({ companyId: null });
  expect(res.status).toBe(200);
  expect(res.body.companyId).toBeNull();
  expect(res.body.company).toBeNull();
});
```

(The `makeCompany` helper already exists in this file; if it only returns the id, it does — it returns `res.body.id`.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest tests/applications.test.js`
Expected: FAIL — `created.body.company` is undefined; `companyId: null` is rejected by validation or ignored.

- [ ] **Step 3: Make `companyId` nullable in `applications.schema.js`**

In `baseFields`, change the `companyId` line:

```js
  companyId: z.string().uuid().nullable().optional(),
```

(Both create and update schemas spread `baseFields`, so both now accept `null`. Create with `null` is equivalent to omitting it.)

- [ ] **Step 4: Update `applications.service.js`** to include company and handle null

Replace the file body with:

```js
const prisma = require('../../shared/database/prisma');
const { NotFoundError } = require('../../shared/utils/errors');

const includeCompany = { company: { select: { id: true, name: true } } };

async function assertCompany(userId, companyId) {
  if (companyId === undefined || companyId === null) return;
  const company = await prisma.company.findFirst({ where: { id: companyId, userId } });
  if (!company) throw new NotFoundError('Company not found');
}

const list = (userId, { status } = {}) =>
  prisma.application.findMany({
    where: { userId, ...(status ? { status } : {}) },
    orderBy: { createdAt: 'desc' },
    include: includeCompany,
  });

async function getById(userId, id) {
  const app = await prisma.application.findFirst({ where: { id, userId }, include: includeCompany });
  if (!app) throw new NotFoundError('Application not found');
  return app;
}

async function create(userId, data) {
  await assertCompany(userId, data.companyId);
  return prisma.application.create({ data: { ...data, userId }, include: includeCompany });
}

async function update(userId, id, data) {
  await getById(userId, id);
  await assertCompany(userId, data.companyId);
  return prisma.application.update({ where: { id }, data, include: includeCompany });
}

async function updateStatus(userId, id, status) {
  await getById(userId, id);
  return prisma.application.update({ where: { id }, data: { status }, include: includeCompany });
}

async function remove(userId, id) {
  await getById(userId, id);
  await prisma.application.delete({ where: { id } });
}

module.exports = { list, getById, create, update, updateStatus, remove };
```

(A `null` `companyId` in `update`'s `data` makes Prisma set the FK to null — the unlink path.)

- [ ] **Step 5: Run the full backend suite**

Run: `npm test`
Expected: PASS — the 3 new tests plus all existing application/dashboard/etc. tests (45 total).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(be): include company on application responses; allow unlinking"
```

---

## Task 2: Frontend — applications API + ApplicationDrawer (form, save, delete, salary guard)

**Repo:** `SmartJobSearchCRM-FE`
**Files:**
- Modify: `src/api/applications.js` (add `updateApplication`, `deleteApplication`)
- Create: `src/components/ApplicationDrawer.jsx`
- Test: `src/components/ApplicationDrawer.test.jsx`

**Interfaces:**
- Consumes: `api`, `listCompanies` (`src/api/companies.js`), `Field`, `Button`, `STATUSES` (export from `src/pages/Applications.jsx`).
- Produces:
  - `applications.js`: `updateApplication(id, body) → application`, `deleteApplication(id) → void`.
  - `ApplicationDrawer.jsx`: default export `<ApplicationDrawer application={app|null} open onClose />`. Renders nothing when `!open`. Edit mode pre-fills from `application`; create mode (null) starts empty. Save calls `createApplication` or `updateApplication` then `onClose`. Delete (edit mode) → confirm → `deleteApplication` then `onClose`. Blocks save when both salaries set and `min > max`. Invalidates `['applications']` on success.

- [ ] **Step 1: Write the failing test — `src/components/ApplicationDrawer.test.jsx`**

```jsx
import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server, API } from '../test/server';
import ApplicationDrawer from './ApplicationDrawer';

function renderDrawer(props) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ApplicationDrawer open onClose={props.onClose || (() => {})} application={props.application ?? null} />
    </QueryClientProvider>,
  );
}

const app = { id: 'a1', position: 'Backend Eng', companyId: null, company: null, status: 'Applied', salaryMin: null, salaryMax: null, source: '', jobDescription: '', notes: 'hi' };

beforeEach(() => server.use(http.get(`${API}/companies`, () => HttpResponse.json([{ id: 'c1', name: 'Acme' }]))));

test('edit mode pre-fills the form from the application', async () => {
  renderDrawer({ application: app });
  await waitFor(() => expect(screen.getByLabelText(/position/i)).toHaveValue('Backend Eng'));
  expect(screen.getByLabelText(/notes/i)).toHaveValue('hi');
});

test('saving an edit PATCHes the application and closes', async () => {
  let body = null;
  server.use(http.patch(`${API}/applications/a1`, async ({ request }) => {
    body = await request.json();
    return HttpResponse.json({ ...app, ...body, company: null });
  }));
  const onClose = vi.fn();
  renderDrawer({ application: app, onClose });
  await userEvent.clear(screen.getByLabelText(/notes/i));
  await userEvent.type(screen.getByLabelText(/notes/i), 'updated');
  await userEvent.click(screen.getByRole('button', { name: /save/i }));
  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(body.notes).toBe('updated');
});

test('create mode POSTs a new application', async () => {
  let body = null;
  server.use(http.post(`${API}/applications`, async ({ request }) => {
    body = await request.json();
    return HttpResponse.json({ id: 'new', ...body, company: null }, { status: 201 });
  }));
  const onClose = vi.fn();
  renderDrawer({ application: null, onClose });
  await userEvent.type(screen.getByLabelText(/position/i), 'Frontend Eng');
  await userEvent.click(screen.getByRole('button', { name: /save/i }));
  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(body.position).toBe('Frontend Eng');
});

test('blocks save when salary min exceeds max', async () => {
  let patched = false;
  server.use(http.patch(`${API}/applications/a1`, () => { patched = true; return HttpResponse.json(app); }));
  renderDrawer({ application: app });
  await userEvent.type(screen.getByLabelText(/min salary/i), '100');
  await userEvent.type(screen.getByLabelText(/max salary/i), '50');
  await userEvent.click(screen.getByRole('button', { name: /save/i }));
  await waitFor(() => expect(screen.getByText(/min.*max|max.*min|salary/i)).toBeInTheDocument());
  expect(patched).toBe(false);
});

test('delete asks for confirmation then DELETEs', async () => {
  let deleted = false;
  server.use(http.delete(`${API}/applications/a1`, () => { deleted = true; return new HttpResponse(null, { status: 204 }); }));
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const onClose = vi.fn();
  renderDrawer({ application: app, onClose });
  await userEvent.click(screen.getByRole('button', { name: /delete/i }));
  await waitFor(() => expect(deleted).toBe(true));
  expect(onClose).toHaveBeenCalled();
  window.confirm.mockRestore();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/ApplicationDrawer.test.jsx`
Expected: FAIL — `./ApplicationDrawer` not found.

- [ ] **Step 3: Add `updateApplication` + `deleteApplication` to `src/api/applications.js`**

Append:

```js
export async function updateApplication(id, body) {
  const { data } = await api.patch(`/applications/${id}`, body);
  return data;
}
export async function deleteApplication(id) {
  await api.delete(`/applications/${id}`);
}
```

- [ ] **Step 4: Write `src/components/ApplicationDrawer.jsx`**

```jsx
import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Trash2 } from 'lucide-react';
import { listCompanies } from '../api/companies';
import { createApplication, updateApplication, deleteApplication } from '../api/applications';
import { STATUSES } from '../pages/Applications';
import Field from './Field';
import Button from './Button';

const toDateInput = (v) => (v ? new Date(v).toISOString().slice(0, 10) : '');
const num = (v) => (v === '' || v == null ? undefined : Number(v));

function initialForm(app) {
  return {
    position: app?.position || '',
    companyId: app?.companyId || '',
    status: app?.status || 'Draft',
    applicationDate: toDateInput(app?.applicationDate),
    salaryMin: app?.salaryMin ?? '',
    salaryMax: app?.salaryMax ?? '',
    source: app?.source || '',
    jobDescription: app?.jobDescription || '',
    notes: app?.notes || '',
  };
}

export default function ApplicationDrawer({ application, open, onClose }) {
  const qc = useQueryClient();
  const isEdit = Boolean(application);
  const [form, setForm] = useState(initialForm(application));
  const [error, setError] = useState(null);
  const firstField = useRef(null);

  useEffect(() => { setForm(initialForm(application)); setError(null); }, [application, open]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    firstField.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: () => listCompanies(), enabled: open });

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: (body) => (isEdit ? updateApplication(application.id, body) : createApplication(body)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['applications'] }); onClose(); },
    onError: (e) => setError(e.response?.data?.error?.message || 'Could not save'),
  });

  const del = useMutation({
    mutationFn: () => deleteApplication(application.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['applications'] }); onClose(); },
  });

  function onSubmit(e) {
    e.preventDefault();
    setError(null);
    const min = num(form.salaryMin);
    const max = num(form.salaryMax);
    if (min != null && max != null && min > max) { setError('Min salary must be ≤ max salary'); return; }
    const body = {
      position: form.position,
      companyId: form.companyId === '' ? null : form.companyId,
      status: form.status,
      applicationDate: form.applicationDate || undefined,
      salaryMin: min,
      salaryMax: max,
      source: form.source || undefined,
      jobDescription: form.jobDescription || undefined,
      notes: form.notes || undefined,
    };
    save.mutate(body);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'Edit application' : 'New application'}
        className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-sky-100 px-5 py-3">
          <h2 className="text-lg font-bold text-slate-900">{isEdit ? 'Application' : 'New application'}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 cursor-pointer">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <form className="flex-1 px-5 py-4" onSubmit={onSubmit}>
          <Field label="Position" name="position" value={form.position} onChange={set('position')} required />

          <label className="block mb-4">
            <span className="block text-sm font-medium text-slate-700 mb-1.5">Company</span>
            <select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              value={form.companyId} onChange={(e) => set('companyId')(e.target.value)}>
              <option value="">No company</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>

          <label className="block mb-4">
            <span className="block text-sm font-medium text-slate-700 mb-1.5">Status</span>
            <select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              value={form.status} onChange={(e) => set('status')(e.target.value)}>
              {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
          </label>

          <Field label="Applied date" name="applicationDate" type="date" value={form.applicationDate} onChange={set('applicationDate')} />
          <div className="flex gap-3">
            <Field label="Min salary" name="salaryMin" type="number" value={form.salaryMin} onChange={set('salaryMin')} />
            <Field label="Max salary" name="salaryMax" type="number" value={form.salaryMax} onChange={set('salaryMax')} />
          </div>
          <Field label="Source" name="source" value={form.source} onChange={set('source')} />

          <label className="block mb-4">
            <span className="block text-sm font-medium text-slate-700 mb-1.5">Job description</span>
            <textarea className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              rows={3} value={form.jobDescription} onChange={(e) => set('jobDescription')(e.target.value)} />
          </label>
          <label className="block mb-4">
            <span className="block text-sm font-medium text-slate-700 mb-1.5">Notes</span>
            <textarea className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              rows={3} value={form.notes} onChange={(e) => set('notes')(e.target.value)} />
          </label>

          {error && <p role="alert" className="mb-3 text-sm text-red-600">{error}</p>}

          <div className="flex items-center gap-2">
            <Button type="submit" disabled={save.isPending}>Save</Button>
            {isEdit && (
              <Button type="button" variant="danger"
                onClick={() => { if (window.confirm('Delete this application?')) del.mutate(); }}>
                <Trash2 size={16} aria-hidden="true" /> Delete
              </Button>
            )}
          </div>
        </form>
      </aside>
    </div>
  );
}
```

> `firstField` ref is declared for future focus management; `Field` doesn't forward refs, so initial focus falls back to the drawer. That's acceptable for v1.5 — do NOT add ref-forwarding now (YAGNI); the Esc-to-close + backdrop dismissal cover the critical interactions. (Remove the unused `firstField` ref and its `.focus()` call to keep the code clean.)

- [ ] **Step 5: Remove the unused ref** noted above — delete the `firstField` declaration and the `firstField.current?.focus();` line so there's no dead code.

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run src/components/ApplicationDrawer.test.jsx`
Expected: PASS (5 tests).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(fe): ApplicationDrawer with full edit/create form, delete, salary guard"
```

---

## Task 3: Frontend — inline "create company" in the drawer's picker

**Repo:** `SmartJobSearchCRM-FE`
**Files:**
- Modify: `src/components/ApplicationDrawer.jsx`
- Test: `src/components/ApplicationDrawer.test.jsx` (add a case)

**Interfaces:**
- Consumes: `createCompany` (`src/api/companies.js`).
- Produces: in the Company section, a "New company" toggle reveals a name input; submitting it calls `createCompany`, invalidates `['companies']`, and sets `form.companyId` to the created company's id.

- [ ] **Step 1: Add a failing test to `src/components/ApplicationDrawer.test.jsx`**

```jsx
import { createCompany } from '../api/companies'; // (no — see note) 

test('can create a company inline and it becomes selected', async () => {
  server.use(http.post(`${API}/companies`, async ({ request }) => {
    const b = await request.json();
    return HttpResponse.json({ id: 'c-new', name: b.name }, { status: 201 });
  }));
  renderDrawer({ application: app });
  await userEvent.click(screen.getByRole('button', { name: /new company/i }));
  await userEvent.type(screen.getByLabelText(/new company name/i), 'Globex');
  await userEvent.click(screen.getByRole('button', { name: /^add$/i }));
  await waitFor(() => expect(screen.getByRole('combobox', { name: /company/i })).toHaveValue('c-new'));
});
```

(Remove the stray `import { createCompany }` line above — the test does not import it; the component does.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/ApplicationDrawer.test.jsx -t "create a company inline"`
Expected: FAIL — no "New company" button.

- [ ] **Step 3: Wire inline company create into `ApplicationDrawer.jsx`**

Add the import:

```js
import { listCompanies, createCompany } from '../api/companies';
```

Add state near the other `useState`s:

```js
const [showNewCompany, setShowNewCompany] = useState(false);
const [newCompanyName, setNewCompanyName] = useState('');

const addCompany = useMutation({
  mutationFn: () => createCompany({ name: newCompanyName.trim() }),
  onSuccess: (c) => {
    qc.invalidateQueries({ queryKey: ['companies'] });
    setForm((f) => ({ ...f, companyId: c.id }));
    setNewCompanyName('');
    setShowNewCompany(false);
  },
});
```

Replace the Company `<label>` block with one that adds the toggle + inline input. The `<select>` gets an accessible name via `aria-label="Company"`:

```jsx
          <div className="mb-4">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Company</span>
              <button type="button" className="text-xs font-medium text-sky-700 hover:underline cursor-pointer"
                onClick={() => setShowNewCompany((s) => !s)}>
                {showNewCompany ? 'Cancel' : 'New company'}
              </button>
            </div>
            <select aria-label="Company"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              value={form.companyId} onChange={(e) => set('companyId')(e.target.value)}>
              <option value="">No company</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {showNewCompany && (
              <div className="mt-2 flex gap-2">
                <input aria-label="New company name"
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  value={newCompanyName} onChange={(e) => setNewCompanyName(e.target.value)} placeholder="Company name" />
                <Button type="button" onClick={() => newCompanyName.trim() && addCompany.mutate()}>Add</Button>
              </div>
            )}
          </div>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/ApplicationDrawer.test.jsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(fe): inline company creation in the application drawer"
```

---

## Task 4: Frontend — interviews section inside the drawer

**Repo:** `SmartJobSearchCRM-FE`
**Files:**
- Modify: `src/api/interviews.js` (let `listInterviews` accept an optional `applicationId`)
- Modify: `src/components/ApplicationDrawer.jsx` (add an Interviews section in edit mode)
- Test: `src/components/ApplicationDrawer.test.jsx` (add a case)

**Interfaces:**
- Consumes: `listInterviews(applicationId)`, `createInterview`, `deleteInterview` (`src/api/interviews.js`).
- Produces: `listInterviews(applicationId?)` passes `?applicationId=` when given. In edit mode the drawer lists `['interviews', application.id]`, supports adding (type select + optional interviewer) via `createInterview`, and deleting via `deleteInterview`; both invalidate `['interviews']`.

- [ ] **Step 1: Add a failing test to `src/components/ApplicationDrawer.test.jsx`**

```jsx
test('lists and adds interviews for the application', async () => {
  const interviews = [{ id: 'iv1', applicationId: 'a1', type: 'HR', interviewer: 'Grace' }];
  server.use(
    http.get(`${API}/interviews`, ({ request }) => {
      const url = new URL(request.url);
      expect(url.searchParams.get('applicationId')).toBe('a1');
      return HttpResponse.json(interviews);
    }),
    http.post(`${API}/interviews`, async ({ request }) => {
      const b = await request.json();
      const created = { id: 'iv2', ...b };
      interviews.push(created);
      return HttpResponse.json(created, { status: 201 });
    }),
  );
  renderDrawer({ application: app });
  await waitFor(() => expect(screen.getByText('Grace')).toBeInTheDocument());
  await userEvent.selectOptions(screen.getByLabelText(/add interview type/i), 'Technical');
  await userEvent.click(screen.getByRole('button', { name: /add interview/i }));
  await waitFor(() => expect(screen.getByText('Technical', { selector: 'span' })).toBeInTheDocument());
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/ApplicationDrawer.test.jsx -t "lists and adds interviews"`
Expected: FAIL — no interviews section.

- [ ] **Step 3: Make `listInterviews` accept an optional applicationId in `src/api/interviews.js`**

Replace `listInterviews`:

```js
export async function listInterviews(applicationId) {
  const { data } = await api.get('/interviews', { params: applicationId ? { applicationId } : {} });
  return data;
}
```

(The standalone Interviews page calls `listInterviews()` with no argument — unchanged behavior.)

- [ ] **Step 4: Add the Interviews section to `ApplicationDrawer.jsx`**

Add imports:

```js
import { listInterviews, createInterview, deleteInterview } from '../api/interviews';
```

Add state + queries/mutations inside the component:

```js
const INTERVIEW_TYPES = ['HR', 'Technical', 'Managerial', 'Final'];
const [ivType, setIvType] = useState('HR');
const [ivInterviewer, setIvInterviewer] = useState('');

const { data: interviews = [] } = useQuery({
  queryKey: ['interviews', application?.id],
  queryFn: () => listInterviews(application.id),
  enabled: open && isEdit,
});
const addInterview = useMutation({
  mutationFn: () => createInterview({ applicationId: application.id, type: ivType, interviewer: ivInterviewer || undefined }),
  onSuccess: () => { setIvInterviewer(''); qc.invalidateQueries({ queryKey: ['interviews'] }); },
});
const removeInterview = useMutation({
  mutationFn: (id) => deleteInterview(id),
  onSuccess: () => qc.invalidateQueries({ queryKey: ['interviews'] }),
});
```

Render the section after the form actions (still inside the `<aside>`, below the `</form>`), in edit mode only:

```jsx
        {isEdit && (
          <div className="border-t border-sky-100 px-5 py-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Interviews</h3>
            <ul className="mb-3 space-y-1">
              {interviews.map((i) => (
                <li key={i.id} className="flex items-center justify-between rounded-lg border border-sky-100 px-3 py-2 text-sm">
                  <span><span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">{i.type}</span>{i.interviewer ? ` · ${i.interviewer}` : ''}</span>
                  <button aria-label="Delete interview" className="text-red-600 cursor-pointer" onClick={() => removeInterview.mutate(i.id)}>
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </li>
              ))}
              {interviews.length === 0 && <li className="text-sm text-slate-400">No interviews yet.</li>}
            </ul>
            <div className="flex gap-2">
              <select aria-label="Add interview type" className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                value={ivType} onChange={(e) => setIvType(e.target.value)}>
                {INTERVIEW_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <input aria-label="Add interview interviewer" placeholder="Interviewer"
                className="flex-1 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                value={ivInterviewer} onChange={(e) => setIvInterviewer(e.target.value)} />
              <Button type="button" onClick={() => addInterview.mutate()}>Add interview</Button>
            </div>
          </div>
        )}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/components/ApplicationDrawer.test.jsx`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(fe): interviews section in the application drawer"
```

---

## Task 5: Frontend — board integration (cards + open drawer + New application)

**Repo:** `SmartJobSearchCRM-FE`
**Files:**
- Modify: `src/pages/Applications.jsx`
- Test: `src/pages/Applications.test.jsx` (add cases)

**Interfaces:**
- Consumes: `ApplicationDrawer`.
- Produces: cards show `company.name` (muted) and a salary chip when `salaryMin`/`salaryMax` set; an **open** icon-button on each card opens the drawer in edit mode; a **New application** button opens the drawer in create mode. The Kanban drag still works (the open button is separate from the drag handle).

- [ ] **Step 1: Add failing tests to `src/pages/Applications.test.jsx`**

```jsx
import userEvent from '@testing-library/user-event';

test('cards show the company name and salary chip', async () => {
  server.use(http.get(`${API}/applications`, () => HttpResponse.json([
    { id: 'a1', position: 'Backend Eng', status: 'Applied', company: { id: 'c1', name: 'Acme' }, salaryMin: 90000, salaryMax: 110000 },
  ])));
  renderPage();
  await waitFor(() => expect(screen.getByText('Backend Eng')).toBeInTheDocument());
  expect(screen.getByText('Acme')).toBeInTheDocument();
  expect(screen.getByText(/90,?000|90k|\$90/i)).toBeInTheDocument();
});

test('clicking a card open button opens the drawer pre-filled', async () => {
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([{ id: 'a1', position: 'Backend Eng', status: 'Applied', company: null }])),
    http.get(`${API}/companies`, () => HttpResponse.json([])),
    http.get(`${API}/interviews`, () => HttpResponse.json([])),
  );
  renderPage();
  await waitFor(() => expect(screen.getByText('Backend Eng')).toBeInTheDocument());
  await userEvent.click(screen.getByRole('button', { name: /open backend eng/i }));
  await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
  expect(screen.getByLabelText(/position/i)).toHaveValue('Backend Eng');
});

test('New application button opens the drawer in create mode', async () => {
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([])),
    http.get(`${API}/companies`, () => HttpResponse.json([])),
  );
  renderPage();
  await userEvent.click(screen.getByRole('button', { name: /new application/i }));
  await waitFor(() => expect(screen.getByRole('dialog', { name: /new application/i })).toBeInTheDocument());
});
```

(`renderPage` already exists in this file. Add the `userEvent` import at the top if not present.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/pages/Applications.test.jsx`
Expected: FAIL — no company on card, no open button, no New application button.

- [ ] **Step 3: Update `src/pages/Applications.jsx`** to integrate the drawer and enrich cards

Add imports at the top:

```js
import { Plus, AlertCircle, Maximize2 } from 'lucide-react';
import ApplicationDrawer from '../components/ApplicationDrawer';
```

Add a salary formatter near the top (after `label`):

```js
const fmtSalary = (min, max) => {
  if (min == null && max == null) return null;
  const k = (n) => `$${Math.round(n / 1000)}k`;
  if (min != null && max != null) return `${k(min)}–${k(max)}`;
  return k(min ?? max);
};
```

Change `Card` to show company + salary + an open button. It needs an `onOpen` callback:

```jsx
function Card({ app, onOpen }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: app.id });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  const salary = fmtSalary(app.salaryMin, app.salaryMax);
  return (
    <div ref={setNodeRef} style={style}
      className={`mb-2 rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-sm transition-shadow ${isDragging ? 'shadow-md ring-2 ring-sky-300' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div {...listeners} {...attributes} aria-label={`${app.position}, ${label(app.status)}`} className="flex-1 cursor-grab">
          <p className="font-medium text-slate-800">{app.position}</p>
          {app.company && <p className="text-xs text-slate-500">{app.company.name}</p>}
          {salary && <span className="mt-1 inline-block rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700">{salary}</span>}
        </div>
        <button type="button" aria-label={`Open ${app.position}`} onClick={() => onOpen(app)}
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer">
          <Maximize2 size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
```

Thread `onOpen` through `Column`:

```jsx
function Column({ status, apps, onOpen }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div ref={setNodeRef} className={`flex w-60 shrink-0 flex-col rounded-xl p-2 ${isOver ? 'bg-sky-50 ring-2 ring-sky-200' : 'bg-slate-50'}`}>
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[status]}`}>{label(status)}</h2>
        <span className="text-xs font-medium text-slate-400">{apps.length}</span>
      </div>
      {apps.map((a) => <Card key={a.id} app={a} onOpen={onOpen} />)}
    </div>
  );
}
```

In the `Applications` component, add drawer state and a "New application" button, and pass `onOpen`:

```jsx
  const [drawer, setDrawer] = useState({ open: false, application: null });
```

In the JSX, add a New application button next to the quick-add form header, and render the drawer + pass `onOpen={(app) => setDrawer({ open: true, application: app })}` to each `Column`. Add at the end of the returned tree (before closing `</div>`):

```jsx
      <ApplicationDrawer
        open={drawer.open}
        application={drawer.application}
        onClose={() => setDrawer({ open: false, application: null })}
      />
```

Add the New application button — put it on its own row above the board, after the quick-add form:

```jsx
      <div className="mb-3">
        <Button variant="subtle" onClick={() => setDrawer({ open: true, application: null })}>
          <Plus size={16} aria-hidden="true" /> New application
        </Button>
      </div>
```

And update the Column render to pass `onOpen`:

```jsx
              <Column key={s} status={s} apps={apps.filter((a) => a.status === s)} onOpen={(app) => setDrawer({ open: true, application: app })} />
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/pages/Applications.test.jsx`
Expected: PASS — new card/open/new-application tests plus the existing column + applyDrop + optimistic tests.

- [ ] **Step 5: Run the full frontend suite + build**

Run: `npm test && npm run build`
Expected: ALL suites pass; build succeeds.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(fe): board integration — card company/salary, open drawer, new application"
```

---

## Task 6: Docs + tracker update

**Repo:** both
**Files:**
- Modify: `SmartJobSearchCRM-FE/TRACKER.md`, `SmartJobSearchCRM-BE/TRACKER.md`, `../TRACKER.md`

- [ ] **Step 1: Update trackers** — add a v1.5 "Application details" line marked done in the FE and BE trackers and the master tracker, with the date and a one-line summary (drawer with full fields, inline company create, interviews in drawer, cards show company + salary; backend includes company + unlink).

- [ ] **Step 2: Commit each repo**

```bash
# in SmartJobSearchCRM-FE
git add TRACKER.md && git commit -m "docs(fe): tracker update for v1.5 application details"
# in SmartJobSearchCRM-BE
git add TRACKER.md && git commit -m "docs(be): tracker update for v1.5 application details"
```

---

## Self-Review Notes

- **Spec coverage:** drawer view/edit/create (Task 2) ✓; company picker + inline create (Tasks 2–3) ✓; interviews in drawer with add/delete (Task 4) ✓; cards show company + salary (Task 5) ✓; backend include company + unlink (Task 1) ✓; salary guard client+server (Task 2 + existing backend) ✓; tests for each on both sides ✓. Deferred per spec (attachments, rich text, bulk edit, activity log) — correctly absent.
- **Type/contract consistency:** `ApplicationDrawer({ application, open, onClose })` identical across definition (Task 2) and call site (Task 5). `listInterviews(applicationId?)` change is backward-compatible with the Interviews page call. Body field names (`companyId`, `salaryMin`, `salaryMax`, `applicationDate`, `jobDescription`) match the backend schema verbatim. `company: { id, name }` shape consistent between Task 1 (produces) and Task 5 (consumes).
- **No placeholders:** every step has runnable code or an exact command. The two intentional "remove this line" steps (unused ref in Task 2 Step 5; stray import note in Task 3 Step 1) are explicit cleanups, not deferrals.
