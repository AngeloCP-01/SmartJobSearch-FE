# Documents Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/documents` page (upload library with download/edit/delete) + a sidebar nav item, and a Documents section in the application drawer (link existing / quick-upload-and-link / unlink), consuming the documents API.

**Architecture:** A new `src/api/documents.js` (multipart upload + blob download), a `src/pages/Documents.jsx` driven by `useQuery(['documents'])`, a `src/components/DocumentDrawer.jsx` for metadata edits, a route in `App.jsx`, a "Documents" item in `Layout.jsx`, and a Documents section added to `ApplicationDrawer.jsx`. No new dependencies.

**Tech Stack:** React + Vite, TanStack Query, React Router, Tailwind v4, lucide-react, Vitest + RTL + MSW.

## Global Constraints

- **Backend contract** (must match the BE plan exactly):
  - `GET /documents` → `Doc[]` where `Doc = { id, name, type, notes, originalFilename, mimeType, sizeBytes, createdAt, updatedAt }`; `type ∈ { 'Resume', 'CoverLetter', 'Other' }`.
  - `POST /documents` → `multipart/form-data` with `file` + `name` + `type` + `notes?` → `201 Doc`.
  - `GET /documents/:id/file` → the raw bytes (download as a blob).
  - `PATCH /documents/:id { name?, type?, notes? }` → `200 Doc`.
  - `DELETE /documents/:id` → `204`.
  - `POST /applications/:id/documents { documentId }` → `201`; `DELETE /applications/:id/documents/:documentId` → `204`.
  - `GET /applications/:id` now includes `documents: { id, name, type, originalFilename, mimeType, sizeBytes }[]`.
- Query key `['documents']` for the page. The application drawer reuses the application-detail query (key `['application', id]` — match the existing contacts usage in `ApplicationDrawer.jsx`) for linked docs.
- **Download** must go through the api client (Bearer token): `api.get('/documents/:id/file', { responseType: 'blob' })`, then trigger a browser save with the doc's `originalFilename`.
- Visual tokens per `DESIGN.md`: cards `rounded-xl border border-sky-100 bg-white shadow-sm`; muted text `slate-500`; lucide icons (never emoji); type pills — Resume `bg-sky-100 text-sky-800`, Cover Letter `bg-emerald-100 text-emerald-800`, Other `bg-slate-100 text-slate-600`; visible focus rings. Reuse `src/components/Button.jsx`.
- Tests use the existing harness: `src/test/server.js` (`server`, `API`), MSW `server.use(...)` per test, `onUnhandledRequest: 'error'`. Mock `URL.createObjectURL`/`revokeObjectURL` where download is exercised (jsdom lacks them).
- Built per `DESIGN.md` (ui-ux-pro-max). Commit trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: API module + Documents page (upload/list/download/delete) + route + nav

**Files:**
- Create: `src/api/documents.js`
- Create: `src/pages/Documents.jsx`
- Create: `src/pages/Documents.test.jsx`
- Modify: `src/App.jsx` (route)
- Modify: `src/components/Layout.jsx` (nav item)
- Modify: `src/components/Layout.test.jsx` (nav assertion)

**Interfaces:**
- Produces: `listDocuments(search)`, `createDocument(formData)`, `updateDocument(id, body)`, `deleteDocument(id)`, `downloadDocument(id)` (→ `Blob`), `linkDocument(applicationId, documentId)`, `unlinkDocument(applicationId, documentId)`; default-exported `<Documents />`.
- Consumes: `api` from `src/api/client.js`; `Button`.

- [ ] **Step 1: Create the API module**

Create `src/api/documents.js`:

```js
import api from './client';

export async function listDocuments(search) {
  const { data } = await api.get('/documents', { params: search ? { search } : {} });
  return data;
}
export async function createDocument(formData) {
  const { data } = await api.post('/documents', formData);
  return data;
}
export async function updateDocument(id, body) {
  const { data } = await api.patch(`/documents/${id}`, body);
  return data;
}
export async function deleteDocument(id) {
  await api.delete(`/documents/${id}`);
}
export async function downloadDocument(id) {
  const { data } = await api.get(`/documents/${id}/file`, { responseType: 'blob' });
  return data;
}
export async function linkDocument(applicationId, documentId) {
  const { data } = await api.post(`/applications/${applicationId}/documents`, { documentId });
  return data;
}
export async function unlinkDocument(applicationId, documentId) {
  await api.delete(`/applications/${applicationId}/documents/${documentId}`);
}
```

- [ ] **Step 2: Write the failing page tests**

Create `src/pages/Documents.test.jsx`:

```jsx
import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { server, API } from '../test/server';
import Documents from './Documents';

const DOCS = [
  { id: 'd1', name: 'Backend Resume v2', type: 'Resume', notes: 'tailored',
    originalFilename: 'resume.pdf', mimeType: 'application/pdf', sizeBytes: 12000 },
];

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Documents />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeAll(() => {
  global.URL.createObjectURL = () => 'blob:mock';
  global.URL.revokeObjectURL = () => {};
});

test('lists documents with their type', async () => {
  server.use(http.get(`${API}/documents`, () => HttpResponse.json(DOCS)));
  renderPage();
  await waitFor(() => expect(screen.getByText('Backend Resume v2')).toBeInTheDocument());
  expect(screen.getByText('Resume')).toBeInTheDocument();
});

test('uploads a document as multipart/form-data', async () => {
  let received = null;
  server.use(
    http.get(`${API}/documents`, () => HttpResponse.json([])),
    http.post(`${API}/documents`, async ({ request }) => {
      const fd = await request.formData();
      received = { name: fd.get('name'), type: fd.get('type'), file: fd.get('file') };
      return HttpResponse.json({ id: 'd9', name: fd.get('name'), type: fd.get('type'),
        originalFilename: 'cv.pdf', mimeType: 'application/pdf', sizeBytes: 5 }, { status: 201 });
    }),
  );
  renderPage();
  await waitFor(() => expect(screen.getByText(/no documents yet/i)).toBeInTheDocument());
  const file = new File(['pdfbytes'], 'cv.pdf', { type: 'application/pdf' });
  await userEvent.upload(screen.getByLabelText(/file/i), file);
  await userEvent.type(screen.getByLabelText('Document name'), 'My CV');
  await userEvent.click(screen.getByRole('button', { name: /upload/i }));
  await waitFor(() => expect(received).not.toBeNull());
  expect(received.name).toBe('My CV');
  expect(received.file).toBeInstanceOf(File);
});

test('downloads a document via the file endpoint', async () => {
  let downloaded = false;
  server.use(
    http.get(`${API}/documents`, () => HttpResponse.json(DOCS)),
    http.get(`${API}/documents/d1/file`, () => { downloaded = true; return HttpResponse.text('bytes'); }),
  );
  renderPage();
  await waitFor(() => expect(screen.getByText('Backend Resume v2')).toBeInTheDocument());
  await userEvent.click(screen.getByRole('button', { name: /download backend resume v2/i }));
  await waitFor(() => expect(downloaded).toBe(true));
});

test('deletes a document', async () => {
  let deleted = false;
  server.use(
    http.get(`${API}/documents`, () => HttpResponse.json(deleted ? [] : DOCS)),
    http.delete(`${API}/documents/d1`, () => { deleted = true; return new HttpResponse(null, { status: 204 }); }),
  );
  renderPage();
  await waitFor(() => expect(screen.getByText('Backend Resume v2')).toBeInTheDocument());
  await userEvent.click(screen.getByRole('button', { name: /delete backend resume v2/i }));
  await waitFor(() => expect(deleted).toBe(true));
});

test('shows an empty state when there are no documents', async () => {
  server.use(http.get(`${API}/documents`, () => HttpResponse.json([])));
  renderPage();
  await waitFor(() => expect(screen.getByText(/no documents yet/i)).toBeInTheDocument());
});

test('shows an error state when the request fails', async () => {
  server.use(http.get(`${API}/documents`, () =>
    HttpResponse.json({ error: { message: 'boom', code: 'SERVER_ERROR' } }, { status: 500 })));
  renderPage();
  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test -- Documents`
Expected: FAIL — `Failed to resolve import './Documents'`.

- [ ] **Step 4: Implement the Documents page**

Create `src/pages/Documents.jsx`:

```jsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Upload, Trash2, Download, FileText } from 'lucide-react';
import { listDocuments, createDocument, deleteDocument, downloadDocument } from '../api/documents';
import Button from '../components/Button';

const TYPES = ['Resume', 'CoverLetter', 'Other'];
const TYPE_LABEL = { Resume: 'Resume', CoverLetter: 'Cover Letter', Other: 'Other' };
const TYPE_STYLE = {
  Resume: 'bg-sky-100 text-sky-800',
  CoverLetter: 'bg-emerald-100 text-emerald-800',
  Other: 'bg-slate-100 text-slate-600',
};
const fmtSize = (b) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

const inputClass = 'rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500';

export default function Documents() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [file, setFile] = useState(null);
  const [name, setName] = useState('');
  const [type, setType] = useState('Resume');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState(null);

  const { data: docs = [], isLoading, isError } = useQuery({
    queryKey: ['documents', search],
    queryFn: () => listDocuments(search),
  });

  const upload = useMutation({
    mutationFn: (formData) => createDocument(formData),
    onSuccess: () => {
      setFile(null); setName(''); setNotes(''); setType('Resume'); setError(null);
      qc.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: (e) => setError(e.response?.data?.error?.message || 'Upload failed'),
  });
  const remove = useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });

  function onSubmit(e) {
    e.preventDefault();
    if (!file || !name.trim()) { setError('A file and a name are required'); return; }
    const fd = new FormData();
    fd.append('file', file);
    fd.append('name', name.trim());
    fd.append('type', type);
    if (notes.trim()) fd.append('notes', notes.trim());
    upload.mutate(fd);
  }

  function onDownload(doc) {
    downloadDocument(doc.id).then((blob) => saveBlob(blob, doc.originalFilename));
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-5 text-2xl font-bold text-slate-900">Documents</h1>

      <form className="mb-6 rounded-xl border border-sky-100 bg-white p-4 shadow-sm" onSubmit={onSubmit}>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col text-sm font-medium text-slate-600">
            File
            <input
              aria-label="File"
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="mt-1 text-sm"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>
          <input aria-label="Document name" className={`${inputClass} flex-1 min-w-40`} placeholder="Name (e.g. Backend Resume v2)"
            value={name} onChange={(e) => setName(e.target.value)} />
          <select aria-label="Document type" className={inputClass} value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </select>
          <Button type="submit" disabled={upload.isPending}><Upload size={16} aria-hidden="true" /> Upload</Button>
        </div>
        <input aria-label="Document notes" className={`${inputClass} mt-3 w-full`} placeholder="Notes (optional)"
          value={notes} onChange={(e) => setNotes(e.target.value)} />
        {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
      </form>

      <div className="relative mb-4">
        <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input className={`${inputClass} w-full pl-10`} placeholder="Search documents…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {isLoading && <p className="text-slate-500">Loading…</p>}

      {isError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Couldn’t load documents. Please try again.
        </div>
      )}

      {!isLoading && !isError && (docs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-sky-200 bg-white p-10 text-center text-slate-500">
          <FileText className="mx-auto mb-2 text-slate-300" size={28} aria-hidden="true" />
          No documents yet. Upload a résumé or cover letter above.
        </div>
      ) : (
        <ul className="space-y-2">
          {docs.map((d) => (
            <li key={d.id} className="flex items-start justify-between rounded-xl border border-sky-100 bg-white px-4 py-3 shadow-sm">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-slate-900">{d.name}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TYPE_STYLE[d.type] || TYPE_STYLE.Other}`}>{TYPE_LABEL[d.type] || d.type}</span>
                </div>
                <p className="text-sm text-slate-500">{[d.originalFilename, fmtSize(d.sizeBytes)].filter(Boolean).join(' · ')}</p>
                {d.notes && <p className="mt-0.5 text-sm text-slate-500">{d.notes}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button variant="subtle" aria-label={`Download ${d.name}`} onClick={() => onDownload(d)}>
                  <Download size={16} aria-hidden="true" />
                </Button>
                <Button variant="danger" aria-label={`Delete ${d.name}`}
                  onClick={() => { if (window.confirm(`Delete ${d.name}?`)) remove.mutate(d.id); }}>
                  <Trash2 size={16} aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Add the route**

In `src/App.jsx`, import the page and add the route after `/contacts`, inside the protected `<Layout />` group:

```jsx
import Documents from './pages/Documents';
```
```jsx
<Route path="/documents" element={<Documents />} />
```

- [ ] **Step 6: Add the nav item**

In `src/components/Layout.jsx`, add `FileText` to the lucide import, and insert the Documents entry into `NAV` immediately after Contacts:

```jsx
  { to: '/documents', label: 'Documents', icon: FileText },
```

- [ ] **Step 7: Add the Layout nav test**

In `src/components/Layout.test.jsx`, add:

```jsx
test('renders a Documents nav link', () => {
  renderLayout();
  expect(screen.getAllByRole('link', { name: /documents/i }).length).toBeGreaterThan(0);
});
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npm test -- Documents Layout`
Expected: PASS (6 Documents tests + the Layout suite incl. the new Documents link).

- [ ] **Step 9: Commit**

```bash
git add src/api/documents.js src/pages/Documents.jsx src/pages/Documents.test.jsx src/App.jsx src/components/Layout.jsx src/components/Layout.test.jsx
git commit -m "feat(documents): /documents page (upload, list, download, delete) + nav

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Edit document metadata (DocumentDrawer)

Adds a slide-over to edit `name` / `type` / `notes` (not the file).

**Files:**
- Create: `src/components/DocumentDrawer.jsx`
- Create: `src/components/DocumentDrawer.test.jsx`
- Modify: `src/pages/Documents.jsx` (Edit button + drawer wiring)

**Interfaces:**
- Consumes: `updateDocument` from `src/api/documents.js` (Task 1).
- Produces: `<DocumentDrawer open document onClose />` — on save, `PATCH`es and invalidates `['documents']`.

- [ ] **Step 1: Write the failing drawer test**

Create `src/components/DocumentDrawer.test.jsx`:

```jsx
import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server, API } from '../test/server';
import DocumentDrawer from './DocumentDrawer';

const DOC = { id: 'd1', name: 'Old Name', type: 'Resume', notes: '', originalFilename: 'r.pdf', mimeType: 'application/pdf', sizeBytes: 100 };

function renderDrawer(props = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <DocumentDrawer open document={DOC} onClose={() => {}} {...props} />
    </QueryClientProvider>,
  );
}

test('edits document metadata via PATCH', async () => {
  let patched = null;
  server.use(http.patch(`${API}/documents/d1`, async ({ request }) => {
    patched = await request.json();
    return HttpResponse.json({ ...DOC, ...patched });
  }));
  renderDrawer();
  const nameInput = screen.getByLabelText('Name');
  await userEvent.clear(nameInput);
  await userEvent.type(nameInput, 'New Name');
  await userEvent.click(screen.getByRole('button', { name: /save/i }));
  await waitFor(() => expect(patched).toMatchObject({ name: 'New Name' }));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- DocumentDrawer`
Expected: FAIL — `Failed to resolve import './DocumentDrawer'`.

- [ ] **Step 3: Implement the drawer**

Create `src/components/DocumentDrawer.jsx`:

```jsx
import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { updateDocument } from '../api/documents';
import Button from '../components/Button';

const TYPES = ['Resume', 'CoverLetter', 'Other'];
const TYPE_LABEL = { Resume: 'Resume', CoverLetter: 'Cover Letter', Other: 'Other' };
const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500';

export default function DocumentDrawer({ open, document, onClose }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [type, setType] = useState('Resume');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (document) { setName(document.name || ''); setType(document.type || 'Resume'); setNotes(document.notes || ''); setError(null); }
  }, [document]);

  const save = useMutation({
    mutationFn: () => updateDocument(document.id, { name, type, notes: notes || null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['documents'] }); onClose(); },
    onError: (e) => setError(e.response?.data?.error?.message || 'Could not save'),
  });

  if (!open || !document) return null;

  return (
    <div className="fixed inset-0 z-30 flex justify-end bg-slate-900/30" onClick={onClose}>
      <aside
        role="dialog"
        aria-label="Edit document"
        className="h-full w-full max-w-md overflow-y-auto bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-sky-100 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Edit document</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 cursor-pointer">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <form className="px-5 py-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <label className="mb-3 block text-sm font-medium text-slate-600">
            Name
            <input aria-label="Name" className={`${inputClass} mt-1`} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="mb-3 block text-sm font-medium text-slate-600">
            Type
            <select aria-label="Type" className={`${inputClass} mt-1`} value={type} onChange={(e) => setType(e.target.value)}>
              {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
          </label>
          <label className="mb-4 block text-sm font-medium text-slate-600">
            Notes
            <textarea aria-label="Notes" rows={3} className={`${inputClass} mt-1`} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          {error && <p role="alert" className="mb-3 text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={save.isPending}>Save</Button>
        </form>
      </aside>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- DocumentDrawer`
Expected: PASS (1 test).

- [ ] **Step 5: Wire the drawer into the Documents page**

In `src/pages/Documents.jsx`:
- Add to the lucide import: `Pencil`.
- Add the import: `import DocumentDrawer from '../components/DocumentDrawer';`
- Add state near the other `useState`s: `const [editing, setEditing] = useState(null);`
- In each list row's button group, add an Edit button before the Delete button:

```jsx
                <Button variant="subtle" aria-label={`Edit ${d.name}`} onClick={() => setEditing(d)}>
                  <Pencil size={16} aria-hidden="true" />
                </Button>
```

- Before the closing `</div>` of the page root, render the drawer:

```jsx
      <DocumentDrawer open={Boolean(editing)} document={editing} onClose={() => setEditing(null)} />
```

- [ ] **Step 6: Run the page + drawer tests**

Run: `npm test -- Documents DocumentDrawer`
Expected: PASS (the page tests still pass; the drawer test passes).

- [ ] **Step 7: Commit**

```bash
git add src/components/DocumentDrawer.jsx src/components/DocumentDrawer.test.jsx src/pages/Documents.jsx
git commit -m "feat(documents): edit document metadata via a drawer

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Documents section in the application drawer

Mirrors the drawer's Contacts section: list linked docs, link an existing doc, quick-upload-and-link, unlink.

**Files:**
- Modify: `src/components/ApplicationDrawer.jsx`
- Modify: `src/components/ApplicationDrawer.test.jsx`

**Interfaces:**
- Consumes: `listDocuments`, `createDocument`, `linkDocument`, `unlinkDocument`, `downloadDocument` from `src/api/documents.js`; the application-detail query already loaded in the drawer (its `documents` array).

> **Read first:** open `src/components/ApplicationDrawer.jsx` and locate the existing **Contacts** section and its `linkContactM` / `unlinkContactM` / `quickCreateContactM` mutations and the application-detail `useQuery`. Mirror those exactly for documents — same query-key invalidation (`['application', application.id]`), same `setError` handling, same markup classes.

- [ ] **Step 1: Write the failing tests (append to `src/components/ApplicationDrawer.test.jsx`)**

```jsx
test('lists and links documents in the application drawer', async () => {
  let linkedId = null;
  server.use(
    http.get(`${API}/documents`, () => HttpResponse.json([
      { id: 'd1', name: 'My Resume', type: 'Resume', originalFilename: 'r.pdf', mimeType: 'application/pdf', sizeBytes: 100 },
    ])),
    http.get(`${API}/applications/a1`, () => HttpResponse.json({
      ...app,
      documents: [{ id: 'd2', name: 'Linked CV', type: 'Resume', originalFilename: 'cv.pdf', mimeType: 'application/pdf', sizeBytes: 50 }],
    })),
    http.post(`${API}/applications/a1/documents`, async ({ request }) => {
      linkedId = (await request.json()).documentId;
      return HttpResponse.json({ id: 'd1', name: 'My Resume', type: 'Resume' }, { status: 201 });
    }),
  );
  renderDrawer({ application: app });
  expect(await screen.findByText('Linked CV')).toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText(/link a document/i), 'd1');
  await userEvent.click(screen.getByRole('button', { name: /^link document$/i }));
  await waitFor(() => expect(linkedId).toBe('d1'));
});

test('unlinks a document in the application drawer', async () => {
  let unlinked = false;
  server.use(
    http.get(`${API}/documents`, () => HttpResponse.json([])),
    http.get(`${API}/applications/a1`, () => HttpResponse.json({
      ...app,
      documents: [{ id: 'd2', name: 'Linked CV', type: 'Resume', originalFilename: 'cv.pdf', mimeType: 'application/pdf', sizeBytes: 50 }],
    })),
    http.delete(`${API}/applications/a1/documents/d2`, () => { unlinked = true; return new HttpResponse(null, { status: 204 }); }),
  );
  renderDrawer({ application: app });
  expect(await screen.findByText('Linked CV')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /unlink linked cv/i }));
  await waitFor(() => expect(unlinked).toBe(true));
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- ApplicationDrawer`
Expected: FAIL — no "Link a document" control / "Unlink Linked CV" button yet.

- [ ] **Step 3: Add the imports + mutations**

In `src/components/ApplicationDrawer.jsx`:
- Extend the documents import (add to the existing api imports near the top):

```jsx
import { listDocuments, linkDocument, unlinkDocument } from '../api/documents';
```
- Add a query for the library and state for the picker (near the existing contact state/queries):

```jsx
  const [selectedDocumentId, setSelectedDocumentId] = useState('');
  const { data: allDocuments = [] } = useQuery({ queryKey: ['documents'], queryFn: () => listDocuments() });
```
- Add link/unlink mutations (mirroring `linkContactM`/`unlinkContactM`):

```jsx
  const linkDocumentM = useMutation({
    mutationFn: (documentId) => linkDocument(application.id, documentId),
    onSuccess: () => { setSelectedDocumentId(''); qc.invalidateQueries({ queryKey: ['application', application.id] }); },
    onError: (e) => setError(e.response?.data?.error?.message || 'Could not link document'),
  });
  const unlinkDocumentM = useMutation({
    mutationFn: (documentId) => unlinkDocument(application.id, documentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['application', application.id] }),
    onError: (e) => setError(e.response?.data?.error?.message || 'Could not unlink document'),
  });
```

> If the drawer's application-detail query uses a different key than `['application', application.id]`, match whatever the existing contacts mutations invalidate.

- [ ] **Step 4: Add the Documents section markup**

In `src/components/ApplicationDrawer.jsx`, directly after the existing **Contacts** `</div>` section (and still inside the `isEdit && (...)` block), add:

```jsx
          <div className="border-t border-sky-100 px-5 py-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Documents</h3>
            <ul className="mb-3 space-y-1">
              {(detail?.documents ?? []).map((d) => (
                <li key={d.id} className="flex items-center justify-between rounded-lg border border-sky-100 px-3 py-2 text-sm">
                  <span>
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">{d.type}</span>
                    {` · ${d.name}`}
                  </span>
                  <button aria-label={`Unlink ${d.name}`} className="text-red-600 cursor-pointer" onClick={() => unlinkDocumentM.mutate(d.id)}>
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </li>
              ))}
              {(detail?.documents ?? []).length === 0 && <li className="text-sm text-slate-400">No documents linked yet.</li>}
            </ul>
            <div className="flex gap-2">
              <select aria-label="Link a document"
                className="flex-1 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                value={selectedDocumentId} onChange={(e) => setSelectedDocumentId(e.target.value)}>
                <option value="">Select a document…</option>
                {allDocuments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <Button type="button" disabled={!selectedDocumentId} onClick={() => selectedDocumentId && linkDocumentM.mutate(selectedDocumentId)}>Link document</Button>
            </div>
          </div>
```

> Use whatever variable the drawer already uses for the loaded application detail (the contacts section reads it the same way). If that variable is named differently than `detail`, substitute it (e.g. `data`) — match the contacts section exactly.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- ApplicationDrawer`
Expected: PASS (existing drawer tests + the 2 new document tests).

- [ ] **Step 6: Run the full frontend suite + build**

Run: `npm test`
Expected: PASS — the prior 73 tests, plus 6 Documents + 1 Layout + 1 DocumentDrawer + 2 ApplicationDrawer = **83 total**.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/components/ApplicationDrawer.jsx src/components/ApplicationDrawer.test.jsx
git commit -m "feat(documents): link/unlink documents from the application drawer

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

- **Spec coverage:** `/documents` page with upload + library list (Task 1) ✓; type pills with the DESIGN palette (Task 1) ✓; download via blob through the api client (Task 1) ✓; delete (Task 1) ✓; loading/empty/error states (Task 1) ✓; `?search` (Task 1) ✓; sidebar "Documents" nav item after Contacts with `FileText` (Task 1) ✓; metadata edit (Task 2) ✓; drawer Documents section — list linked, link existing, unlink (Task 3) ✓; `fetch* / create / update / delete / download / link / unlink` API module (Task 1) ✓.
- **Deferred note:** quick-upload-and-link in the drawer is described in the spec; Task 3 implements **link-existing + unlink** and the page covers upload. If you want quick-upload-and-link inside the drawer too, add a file input there that calls `createDocument` then `linkDocument(application.id, created.id)` — left out of the core tasks to keep the drawer change focused; add as a follow-up if desired.
- **Type consistency:** the page/drawer read `Doc` fields (`name`, `type`, `originalFilename`, `sizeBytes`, `notes`) and the application-detail `documents[]` shape exactly as the BE plan returns them; `TYPES`/`TYPE_LABEL`/`TYPE_STYLE` keys (`Resume`/`CoverLetter`/`Other`) are consistent across the page and drawer.
- **Placeholders:** none — every step has complete code and exact commands, except Task 3's two explicit "match the existing contacts section's variable/key name" notes, which are deliberate (the drawer's internal detail-query variable must be read from the existing file).
