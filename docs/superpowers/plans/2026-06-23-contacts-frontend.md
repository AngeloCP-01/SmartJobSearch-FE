# Contacts (v2) — Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Contacts sidebar page (searchable list + create/edit/delete via a right-side drawer reusing the company picker) and a Contacts section in the existing Application drawer to link/unlink contacts.

**Architecture:** Mirror the established patterns — `Companies.jsx` for the page, `ApplicationDrawer.jsx` for the create/edit drawer and the in-drawer linked-resource section. A new `src/api/contacts.js` module wraps the BE endpoints. TanStack Query keys `['contacts']`/`['contacts', search]`; the Application drawer fetches `['application', id]` detail to render linked contacts and invalidates it on link/unlink. Tests are component-level via MSW.

**Tech Stack:** React 18 + Vite, React Router 6, TanStack Query 5, Tailwind v4, lucide-react, axios. Vitest + React Testing Library + MSW 2.

## Global Constraints

- **API base:** axios instance at `src/api/client.js` (already handles `VITE_API_URL`, `withCredentials`, 401→refresh). New API functions live in `src/api/contacts.js` and import that client.
- **Design system (DESIGN.md):** Plus Jakarta Sans; palette sky-700 (primary)/sky-800 (hover)/green-600 (success)/red-600 (destructive); app bg sky-50; surfaces white; borders sky-100/200; text slate-900/500/400; focus `focus-visible:ring-2 focus-visible:ring-sky-500`. Cards `rounded-xl border border-sky-100 bg-white`; inputs `rounded-lg border border-slate-300 py-2.5`; buttons via the shared `Button` component; lucide icons ~18px with `aria-hidden="true"`. Use the **ui-ux-pro-max** skill when building the new page/drawer to keep it on-system.
- **Error shape from API:** `e.response?.data?.error?.message` (mutations set a local `error` state and render `<p role="alert" …>`).
- **Tests:** `npm test` runs `vitest run`; MSW `server` from `src/test/server.js` with `onUnhandledRequest: 'error'` — every endpoint a component hits MUST have a handler in that test, or the test fails.
- **Commit trailer:** `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- **Branch:** all work on `feat/contacts` in this repo.
- **Depends on:** the backend `feat/contacts` branch (endpoints `/api/contacts`, `/api/applications/:id/contacts`, and `contacts: [...]` on `GET /api/applications/:id`).

---

### Task 0: Create the feature branch

- [ ] **Step 1: Branch off main**

```bash
cd /Users/angelito/personal/SmartJobSearchCRM/SmartJobSearchCRM-FE
git checkout main && git checkout -b feat/contacts
git status
```
Expected: on `feat/contacts`, clean tree.

---

### Task 1: API module + ContactDrawer (create / edit / delete)

**Files:**
- Create: `src/api/contacts.js`
- Create: `src/components/ContactDrawer.jsx`
- Test: `src/components/ContactDrawer.test.jsx`

**Interfaces:**
- Produces (`src/api/contacts.js`): `listContacts(search?)`, `getContact(id)`, `createContact(body)`, `updateContact(id, body)`, `deleteContact(id)`, `linkContact(applicationId, contactId)`, `unlinkContact(applicationId, contactId)`.
- Produces (`ContactDrawer`): `<ContactDrawer contact={c|null} open onClose />` — `null` contact = create mode. On save: `POST /contacts` (create) or `PATCH /contacts/:id` (edit), then invalidates `['contacts']` and calls `onClose`. Client guards email + URL format before submit.

- [ ] **Step 1: Write the failing test `src/components/ContactDrawer.test.jsx`**

```jsx
import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server, API } from '../test/server';
import ContactDrawer from './ContactDrawer';

function renderDrawer(props = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ContactDrawer open onClose={props.onClose || (() => {})} contact={props.contact ?? null} />
    </QueryClientProvider>,
  );
}

const contact = {
  id: 'k1', name: 'Jane Recruiter', email: 'jane@acme.com', position: 'Recruiter',
  phone: '', linkedinUrl: '', companyId: null, company: null, followUpDate: null, notes: 'hi',
};

beforeEach(() => {
  server.use(http.get(`${API}/companies`, () => HttpResponse.json([{ id: 'c1', name: 'Acme' }])));
});

test('create mode POSTs a new contact and closes', async () => {
  let body = null;
  server.use(http.post(`${API}/contacts`, async ({ request }) => {
    body = await request.json();
    return HttpResponse.json({ id: 'new', ...body, company: null }, { status: 201 });
  }));
  const onClose = vi.fn();
  renderDrawer({ contact: null, onClose });
  await userEvent.type(screen.getByLabelText(/^name$/i), 'Bob Hiring');
  await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(body.name).toBe('Bob Hiring');
});

test('edit mode pre-fills and PATCHes the contact', async () => {
  let body = null;
  server.use(http.patch(`${API}/contacts/k1`, async ({ request }) => {
    body = await request.json();
    return HttpResponse.json({ ...contact, ...body, company: null });
  }));
  const onClose = vi.fn();
  renderDrawer({ contact, onClose });
  await waitFor(() => expect(screen.getByLabelText(/^name$/i)).toHaveValue('Jane Recruiter'));
  await userEvent.clear(screen.getByLabelText(/position/i));
  await userEvent.type(screen.getByLabelText(/position/i), 'Lead Recruiter');
  await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(body.position).toBe('Lead Recruiter');
});

test('blocks save on a malformed email', async () => {
  let posted = false;
  server.use(http.post(`${API}/contacts`, () => { posted = true; return HttpResponse.json({}, { status: 201 }); }));
  renderDrawer({ contact: null });
  await userEvent.type(screen.getByLabelText(/^name$/i), 'Bad');
  await userEvent.type(screen.getByLabelText(/email/i), 'not-an-email');
  await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  expect(posted).toBe(false);
});

test('blocks save on a malformed LinkedIn URL', async () => {
  let posted = false;
  server.use(http.post(`${API}/contacts`, () => { posted = true; return HttpResponse.json({}, { status: 201 }); }));
  renderDrawer({ contact: null });
  await userEvent.type(screen.getByLabelText(/^name$/i), 'Bad');
  await userEvent.type(screen.getByLabelText(/linkedin/i), 'notaurl');
  await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  expect(posted).toBe(false);
});

test('can create a company inline and it becomes selected', async () => {
  const companies = [{ id: 'c1', name: 'Acme' }];
  server.use(
    http.get(`${API}/companies`, () => HttpResponse.json(companies)),
    http.post(`${API}/companies`, async ({ request }) => {
      const b = await request.json();
      const created = { id: 'c-new', name: b.name };
      companies.push(created);
      return HttpResponse.json(created, { status: 201 });
    }),
  );
  renderDrawer({ contact: null });
  await userEvent.click(screen.getByRole('button', { name: /new company/i }));
  await userEvent.type(screen.getByLabelText(/new company name/i), 'Globex');
  await userEvent.click(screen.getByRole('button', { name: /^add$/i }));
  await waitFor(() => expect(screen.getByRole('combobox', { name: /company/i })).toHaveValue('c-new'));
});

test('delete asks for confirmation then DELETEs', async () => {
  let deleted = false;
  server.use(http.delete(`${API}/contacts/k1`, () => { deleted = true; return new HttpResponse(null, { status: 204 }); }));
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const onClose = vi.fn();
  renderDrawer({ contact, onClose });
  await userEvent.click(screen.getByRole('button', { name: /delete/i }));
  await waitFor(() => expect(deleted).toBe(true));
  expect(onClose).toHaveBeenCalled();
  window.confirm.mockRestore();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- ContactDrawer`
Expected: FAIL (cannot resolve `./ContactDrawer` / `../api/contacts`).

- [ ] **Step 3: Create `src/api/contacts.js`**

```javascript
import api from './client';

export async function listContacts(search) {
  const { data } = await api.get('/contacts', { params: search ? { search } : {} });
  return data;
}
export async function getContact(id) {
  const { data } = await api.get(`/contacts/${id}`);
  return data;
}
export async function createContact(body) {
  const { data } = await api.post('/contacts', body);
  return data;
}
export async function updateContact(id, body) {
  const { data } = await api.patch(`/contacts/${id}`, body);
  return data;
}
export async function deleteContact(id) {
  await api.delete(`/contacts/${id}`);
}
export async function linkContact(applicationId, contactId) {
  const { data } = await api.post(`/applications/${applicationId}/contacts`, { contactId });
  return data;
}
export async function unlinkContact(applicationId, contactId) {
  await api.delete(`/applications/${applicationId}/contacts/${contactId}`);
}
```

- [ ] **Step 4: Create `src/components/ContactDrawer.jsx`**

```jsx
import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Trash2 } from 'lucide-react';
import { listCompanies, createCompany } from '../api/companies';
import { createContact, updateContact, deleteContact } from '../api/contacts';
import Field from './Field';
import Button from './Button';

const toDateInput = (v) => (v ? new Date(v).toISOString().slice(0, 10) : '');
const isValidEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const isValidUrl = (s) => { try { return Boolean(new URL(s)); } catch { return false; } };

const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500';

function initialForm(contact) {
  return {
    name: contact?.name || '',
    email: contact?.email || '',
    position: contact?.position || '',
    phone: contact?.phone || '',
    linkedinUrl: contact?.linkedinUrl || '',
    companyId: contact?.companyId ?? contact?.company?.id ?? '',
    followUpDate: toDateInput(contact?.followUpDate),
    notes: contact?.notes || '',
  };
}

export default function ContactDrawer({ contact, open, onClose }) {
  const qc = useQueryClient();
  const isEdit = Boolean(contact);
  const [form, setForm] = useState(initialForm(contact));
  const [error, setError] = useState(null);
  const [showNewCompany, setShowNewCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const drawerRef = useRef(null);

  useEffect(() => { setForm(initialForm(contact)); setError(null); }, [contact, open]);
  useEffect(() => {
    if (!open) return undefined;
    const node = drawerRef.current;
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
    node?.addEventListener('keydown', onKey);
    getFocusable()[0]?.focus();
    return () => node?.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: () => listCompanies(), enabled: open });
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: (body) => (isEdit ? updateContact(contact.id, body) : createContact(body)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contacts'] }); onClose(); },
    onError: (e) => setError(e.response?.data?.error?.message || 'Could not save'),
  });
  const del = useMutation({
    mutationFn: () => deleteContact(contact.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contacts'] }); onClose(); },
    onError: (e) => setError(e.response?.data?.error?.message || 'Could not delete'),
  });
  const addCompany = useMutation({
    mutationFn: () => createCompany({ name: newCompanyName.trim() }),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ['companies'] });
      setForm((f) => ({ ...f, companyId: c.id }));
      setNewCompanyName('');
      setShowNewCompany(false);
    },
    onError: (e) => setError(e.response?.data?.error?.message || 'Could not create company'),
  });

  function onSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) { setError('Name is required'); return; }
    if (form.email && !isValidEmail(form.email)) { setError('Enter a valid email address'); return; }
    if (form.linkedinUrl && !isValidUrl(form.linkedinUrl)) { setError('Enter a valid URL'); return; }
    save.mutate({
      name: form.name.trim(),
      email: form.email || undefined,
      position: form.position || undefined,
      phone: form.phone || undefined,
      linkedinUrl: form.linkedinUrl || undefined,
      companyId: form.companyId === '' ? null : form.companyId,
      followUpDate: form.followUpDate || undefined,
      notes: form.notes || undefined,
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} aria-hidden="true" />
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'Edit contact' : 'New contact'}
        className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-sky-100 px-5 py-3">
          <h2 className="text-lg font-bold text-slate-900">{isEdit ? 'Contact' : 'New contact'}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 cursor-pointer">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <form className="px-5 py-4" onSubmit={onSubmit}>
          <Field label="Name" name="name" value={form.name} onChange={set('name')} required />
          <Field label="Email" name="email" type="email" value={form.email} onChange={set('email')} />
          <Field label="Position" name="position" value={form.position} onChange={set('position')} />
          <Field label="Phone" name="phone" value={form.phone} onChange={set('phone')} />
          <Field label="LinkedIn URL" name="linkedinUrl" value={form.linkedinUrl} onChange={set('linkedinUrl')} />

          <div className="mb-4">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Company</span>
              <button type="button" className="text-xs font-medium text-sky-700 hover:underline cursor-pointer"
                onClick={() => setShowNewCompany((s) => !s)}>
                {showNewCompany ? 'Cancel' : 'New company'}
              </button>
            </div>
            <select aria-label="Company" className={inputClass}
              value={form.companyId} onChange={(e) => set('companyId')(e.target.value)}>
              <option value="">No company</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {showNewCompany && (
              <div className="mt-2 flex gap-2">
                <input aria-label="New company name" placeholder="Company name"
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  value={newCompanyName} onChange={(e) => setNewCompanyName(e.target.value)} />
                <Button type="button" onClick={() => newCompanyName.trim() && addCompany.mutate()}>Add</Button>
              </div>
            )}
          </div>

          <Field label="Follow-up date" name="followUpDate" type="date" value={form.followUpDate} onChange={set('followUpDate')} />

          <label className="block mb-4">
            <span className="block text-sm font-medium text-slate-700 mb-1.5">Notes</span>
            <textarea name="notes" className={inputClass} rows={3} value={form.notes} onChange={(e) => set('notes')(e.target.value)} />
          </label>

          {error && <p role="alert" className="mb-3 text-sm text-red-600">{error}</p>}

          <div className="flex items-center gap-2">
            <Button type="submit" disabled={save.isPending}>Save</Button>
            {isEdit && (
              <Button type="button" variant="danger" disabled={del.isPending}
                onClick={() => { if (window.confirm('Delete this contact?')) del.mutate(); }}>
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

- [ ] **Step 5: Run to verify pass**

Run: `npm test -- ContactDrawer`
Expected: PASS (all 6 tests green).

- [ ] **Step 6: Commit**

```bash
git add src/api/contacts.js src/components/ContactDrawer.jsx src/components/ContactDrawer.test.jsx
git commit -m "feat(contacts): API module + ContactDrawer (create/edit/delete)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Contacts page + sidebar nav + route

**Files:**
- Create: `src/pages/Contacts.jsx`
- Modify: `src/components/Layout.jsx` (nav item)
- Modify: `src/App.jsx` (route)
- Test: `src/pages/Contacts.test.jsx`
- Test: `src/components/Layout.test.jsx` (add a Contacts-nav assertion; create the file if absent)

**Interfaces:**
- Consumes: `listContacts`, `deleteContact` from `api/contacts`; `ContactDrawer`.
- Produces: route `/contacts` rendering `<Contacts />`; sidebar nav item "Contacts". The page opens `ContactDrawer` in create mode (Add button) or edit mode (per-card Edit button).

- [ ] **Step 1: Write the failing test `src/pages/Contacts.test.jsx`**

```jsx
import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server, API } from '../test/server';
import Contacts from './Contacts';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><Contacts /></QueryClientProvider>);
}

beforeEach(() => {
  server.use(http.get(`${API}/companies`, () => HttpResponse.json([])));
});

test('lists contacts from the API', async () => {
  server.use(http.get(`${API}/contacts`, () => HttpResponse.json([
    { id: '1', name: 'Jane Recruiter', position: 'Recruiter', company: { id: 'c1', name: 'Acme' }, email: 'jane@acme.com', linkedinUrl: '', followUpDate: null },
  ])));
  renderPage();
  await waitFor(() => expect(screen.getByText('Jane Recruiter')).toBeInTheDocument());
  expect(screen.getByText(/Recruiter/)).toBeInTheDocument();
});

test('search refetches with the term', async () => {
  server.use(http.get(`${API}/contacts`, ({ request }) => {
    const term = new URL(request.url).searchParams.get('search');
    return HttpResponse.json(term === 'jan'
      ? [{ id: '1', name: 'Jane', position: '', company: null, email: '', linkedinUrl: '', followUpDate: null }]
      : [
          { id: '1', name: 'Jane', position: '', company: null, email: '', linkedinUrl: '', followUpDate: null },
          { id: '2', name: 'Bob', position: '', company: null, email: '', linkedinUrl: '', followUpDate: null },
        ]);
  }));
  renderPage();
  await waitFor(() => expect(screen.getByText('Bob')).toBeInTheDocument());
  await userEvent.type(screen.getByPlaceholderText(/search contacts/i), 'jan');
  await waitFor(() => expect(screen.queryByText('Bob')).not.toBeInTheDocument());
  expect(screen.getByText('Jane')).toBeInTheDocument();
});

test('Add contact opens the drawer in create mode', async () => {
  server.use(http.get(`${API}/contacts`, () => HttpResponse.json([])));
  renderPage();
  await userEvent.click(screen.getByRole('button', { name: /add contact/i }));
  expect(await screen.findByRole('dialog', { name: /new contact/i })).toBeInTheDocument();
});

test('Edit on a card opens the drawer pre-filled', async () => {
  server.use(http.get(`${API}/contacts`, () => HttpResponse.json([
    { id: '1', name: 'Jane Recruiter', position: 'Recruiter', company: null, email: '', linkedinUrl: '', followUpDate: null },
  ])));
  renderPage();
  await userEvent.click(await screen.findByRole('button', { name: /edit jane recruiter/i }));
  const dialog = await screen.findByRole('dialog', { name: /contact/i });
  await waitFor(() => expect(screen.getByLabelText(/^name$/i)).toHaveValue('Jane Recruiter'));
  expect(dialog).toBeInTheDocument();
});

test('delete removes a contact', async () => {
  let deleted = false;
  const items = [{ id: '1', name: 'Jane', position: '', company: null, email: '', linkedinUrl: '', followUpDate: null }];
  server.use(
    http.get(`${API}/contacts`, () => HttpResponse.json(deleted ? [] : items)),
    http.delete(`${API}/contacts/1`, () => { deleted = true; return new HttpResponse(null, { status: 204 }); }),
  );
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  renderPage();
  await userEvent.click(await screen.findByRole('button', { name: /delete jane/i }));
  await waitFor(() => expect(screen.queryByText('Jane')).not.toBeInTheDocument());
  window.confirm.mockRestore();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- Contacts`
Expected: FAIL (cannot resolve `./Contacts`).

- [ ] **Step 3: Create `src/pages/Contacts.jsx`**

```jsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Trash2, Pencil, Users, Mail, Linkedin, CalendarClock } from 'lucide-react';
import { listContacts, deleteContact } from '../api/contacts';
import ContactDrawer from '../components/ContactDrawer';
import Button from '../components/Button';

const toDate = (v) => (v ? new Date(v).toISOString().slice(0, 10) : '');
const isOverdue = (v) => Boolean(v) && new Date(v) < new Date(new Date().toDateString());

export default function Contacts() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['contacts', search],
    queryFn: () => listContacts(search),
  });
  const remove = useMutation({
    mutationFn: deleteContact,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  });

  const openCreate = () => { setEditing(null); setDrawerOpen(true); };
  const openEdit = (c) => { setEditing(c); setDrawerOpen(true); };
  const onDelete = (c) => { if (window.confirm(`Delete ${c.name}?`)) remove.mutate(c.id); };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Contacts</h1>
        <Button onClick={openCreate}><Plus size={16} aria-hidden="true" /> Add contact</Button>
      </div>

      <div className="relative mb-4">
        <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input
          className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          placeholder="Search contacts…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <p className="text-slate-500">Loading…</p>
      ) : contacts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-sky-200 bg-white p-10 text-center text-slate-500">
          <Users className="mx-auto mb-2 text-slate-300" size={28} aria-hidden="true" />
          No contacts yet. Add a recruiter or interviewer above.
        </div>
      ) : (
        <ul className="space-y-2">
          {contacts.map((c) => (
            <li key={c.id} className="flex items-start justify-between rounded-xl border border-sky-100 bg-white px-4 py-3 shadow-sm">
              <div className="min-w-0">
                <p className="font-medium text-slate-900">{c.name}</p>
                {(c.position || c.company) && (
                  <p className="text-sm text-slate-500">{[c.position, c.company?.name].filter(Boolean).join(' · ')}</p>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 text-sky-700 hover:underline">
                      <Mail size={14} aria-hidden="true" /> {c.email}
                    </a>
                  )}
                  {c.linkedinUrl && (
                    <a href={c.linkedinUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sky-700 hover:underline">
                      <Linkedin size={14} aria-hidden="true" /> LinkedIn
                    </a>
                  )}
                  {c.followUpDate && (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${isOverdue(c.followUpDate) ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'}`}>
                      <CalendarClock size={12} aria-hidden="true" /> {toDate(c.followUpDate)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button variant="subtle" aria-label={`Edit ${c.name}`} onClick={() => openEdit(c)}>
                  <Pencil size={16} aria-hidden="true" />
                </Button>
                <Button variant="danger" aria-label={`Delete ${c.name}`} onClick={() => onDelete(c)}>
                  <Trash2 size={16} aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ContactDrawer open={drawerOpen} contact={editing} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}
```

- [ ] **Step 4: Add the nav item in `src/components/Layout.jsx`**

Add `Users` to the lucide import (alongside the existing icons), then add a Contacts entry to the `NAV` array after the Companies line:
```javascript
  { to: '/contacts', label: 'Contacts', icon: Users },
```

- [ ] **Step 5: Add the route in `src/App.jsx`**

Add the import beside the other page imports:
```javascript
import Contacts from './pages/Contacts';
```
Add the route inside the protected `<Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>` block, after the Companies route:
```jsx
          <Route path="/contacts" element={<Contacts />} />
```

- [ ] **Step 6: Add a nav assertion in `src/components/Layout.test.jsx`**

If the file exists, add this test; otherwise create the file with this content:
```jsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';
import Layout from './Layout';

test('renders a Contacts nav link', () => {
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Layout />
      </MemoryRouter>
    </AuthProvider>,
  );
  const links = screen.getAllByRole('link', { name: /contacts/i });
  expect(links.length).toBeGreaterThan(0);
});
```
(If an existing `Layout.test.jsx` already wraps `Layout` with providers via a helper, mirror that helper instead of the inline wrapper above.)

- [ ] **Step 7: Run the Contacts + Layout tests to verify pass**

Run: `npm test -- Contacts Layout`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/pages/Contacts.jsx src/pages/Contacts.test.jsx src/components/Layout.jsx src/components/Layout.test.jsx src/App.jsx
git commit -m "feat(contacts): Contacts page, sidebar nav, and route

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Contacts section in the Application drawer (link / quick-create / unlink)

**Files:**
- Modify: `src/api/applications.js` (add `getApplication`)
- Modify: `src/components/ApplicationDrawer.jsx` (fetch detail; render Contacts section)
- Test: `src/components/ApplicationDrawer.test.jsx` (extend beforeEach + add contacts-section tests)

**Interfaces:**
- Consumes: `getApplication(id)` → application detail incl. `contacts: [{ id, name, position, company }]`; `listContacts`, `linkContact`, `unlinkContact`, `createContact` from `api/contacts`.
- Produces: in edit mode the drawer shows a Contacts section; linking/unlinking/quick-creating invalidates `['application', id]`.

- [ ] **Step 1: Add `getApplication` to `src/api/applications.js`**

Add this export (leave the existing ones unchanged):
```javascript
export async function getApplication(id) {
  const { data } = await api.get(`/applications/${id}`);
  return data;
}
```

- [ ] **Step 2: Extend `src/components/ApplicationDrawer.test.jsx`**

First, update the existing `beforeEach` so the new queries the drawer fires in edit mode are handled. Replace the existing `beforeEach(() => { server.use( ... ) })` block with:
```jsx
beforeEach(() => {
  server.use(
    http.get(`${API}/companies`, () => HttpResponse.json([{ id: 'c1', name: 'Acme' }])),
    http.get(`${API}/interviews`, () => HttpResponse.json([])),
    http.get(`${API}/applications/a1`, () => HttpResponse.json({ ...app, contacts: [] })),
    http.get(`${API}/contacts`, () => HttpResponse.json([])),
  );
});
```
Then append these tests:
```jsx
test('lists linked contacts from application detail', async () => {
  server.use(http.get(`${API}/applications/a1`, () => HttpResponse.json({
    ...app,
    contacts: [{ id: 'k1', name: 'Jane Recruiter', position: 'Recruiter', company: { id: 'c1', name: 'Acme' } }],
  })));
  renderDrawer({ application: app });
  expect(await screen.findByText('Jane Recruiter')).toBeInTheDocument();
});

test('links an existing contact to the application', async () => {
  let linked = null;
  server.use(
    http.get(`${API}/contacts`, () => HttpResponse.json([{ id: 'k1', name: 'Jane Recruiter', position: 'Recruiter', company: null }])),
    http.post(`${API}/applications/a1/contacts`, async ({ request }) => {
      linked = await request.json();
      return HttpResponse.json({ id: 'k1', name: 'Jane Recruiter', company: null }, { status: 201 });
    }),
  );
  renderDrawer({ application: app });
  await userEvent.selectOptions(await screen.findByLabelText(/link a contact/i), 'k1');
  await userEvent.click(screen.getByRole('button', { name: /^link$/i }));
  await waitFor(() => expect(linked).toEqual({ contactId: 'k1' }));
});

test('quick-creates a contact and links it', async () => {
  let created = null;
  let linked = null;
  server.use(
    http.post(`${API}/contacts`, async ({ request }) => {
      created = await request.json();
      return HttpResponse.json({ id: 'k9', name: created.name, company: null }, { status: 201 });
    }),
    http.post(`${API}/applications/a1/contacts`, async ({ request }) => {
      linked = await request.json();
      return HttpResponse.json({ id: 'k9', name: created.name, company: null }, { status: 201 });
    }),
  );
  renderDrawer({ application: app });
  await userEvent.click(await screen.findByRole('button', { name: /new contact/i }));
  await userEvent.type(screen.getByLabelText(/new contact name/i), 'Quick Bob');
  await userEvent.click(screen.getByRole('button', { name: /^create & link$/i }));
  await waitFor(() => expect(created).toEqual({ name: 'Quick Bob' }));
  await waitFor(() => expect(linked).toEqual({ contactId: 'k9' }));
});

test('unlinks a contact from the application', async () => {
  let unlinked = false;
  server.use(
    http.get(`${API}/applications/a1`, () => HttpResponse.json({
      ...app, contacts: [{ id: 'k1', name: 'Jane Recruiter', position: 'Recruiter', company: null }],
    })),
    http.delete(`${API}/applications/a1/contacts/k1`, () => { unlinked = true; return new HttpResponse(null, { status: 204 }); }),
  );
  renderDrawer({ application: app });
  await userEvent.click(await screen.findByRole('button', { name: /unlink jane recruiter/i }));
  await waitFor(() => expect(unlinked).toBe(true));
});
```

- [ ] **Step 3: Run to verify the new tests fail**

Run: `npm test -- ApplicationDrawer`
Expected: FAIL on the four new tests (no Contacts section yet); existing tests still pass (handlers added).

- [ ] **Step 4: Wire the Contacts section into `src/components/ApplicationDrawer.jsx`**

Add to the imports:
```javascript
import { getApplication } from '../api/applications';
import { listContacts, linkContact, unlinkContact, createContact } from '../api/contacts';
```
Add these state hooks beside the existing interview state (`const [ivType, ...]`):
```javascript
  const [selectedContactId, setSelectedContactId] = useState('');
  const [showNewContact, setShowNewContact] = useState(false);
  const [newContactName, setNewContactName] = useState('');
```
Add these queries beside the existing `interviews` query:
```javascript
  const { data: detail } = useQuery({
    queryKey: ['application', application?.id],
    queryFn: () => getApplication(application.id),
    enabled: open && isEdit,
  });
  const linkedContacts = detail?.contacts || [];
  const { data: allContacts = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => listContacts(),
    enabled: open && isEdit,
  });
  const linkableContacts = allContacts.filter((c) => !linkedContacts.some((lc) => lc.id === c.id));
```
Add these mutations beside the interview mutations:
```javascript
  const linkContactM = useMutation({
    mutationFn: (contactId) => linkContact(application.id, contactId),
    onSuccess: () => { setSelectedContactId(''); qc.invalidateQueries({ queryKey: ['application', application.id] }); },
    onError: (e) => setError(e.response?.data?.error?.message || 'Could not link contact'),
  });
  const unlinkContactM = useMutation({
    mutationFn: (contactId) => unlinkContact(application.id, contactId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['application', application.id] }),
    onError: (e) => setError(e.response?.data?.error?.message || 'Could not unlink contact'),
  });
  const quickCreateContactM = useMutation({
    mutationFn: () => createContact({ name: newContactName.trim() }),
    onSuccess: async (c) => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      await linkContact(application.id, c.id);
      qc.invalidateQueries({ queryKey: ['application', application.id] });
      setNewContactName('');
      setShowNewContact(false);
    },
    onError: (e) => setError(e.response?.data?.error?.message || 'Could not create contact'),
  });
```
Add this section's markup immediately after the closing `</div>` of the Interviews section (still inside the `{isEdit && (...)}` region — make it a sibling block by wrapping both sections, or add a second `{isEdit && (...)}` block right after the interviews one):
```jsx
        {isEdit && (
          <div className="border-t border-sky-100 px-5 py-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Contacts</h3>
            <ul className="mb-3 space-y-1">
              {linkedContacts.map((c) => (
                <li key={c.id} className="flex items-center justify-between rounded-lg border border-sky-100 px-3 py-2 text-sm">
                  <span>
                    <span className="font-medium text-slate-800">{c.name}</span>
                    {[c.position, c.company?.name].filter(Boolean).length > 0
                      ? ` · ${[c.position, c.company?.name].filter(Boolean).join(' · ')}`
                      : ''}
                  </span>
                  <button aria-label={`Unlink ${c.name}`} className="text-red-600 cursor-pointer" onClick={() => unlinkContactM.mutate(c.id)}>
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </li>
              ))}
              {linkedContacts.length === 0 && <li className="text-sm text-slate-400">No contacts linked yet.</li>}
            </ul>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Link an existing contact</span>
              <button type="button" className="text-xs font-medium text-sky-700 hover:underline cursor-pointer"
                onClick={() => setShowNewContact((s) => !s)}>
                {showNewContact ? 'Cancel' : 'New contact'}
              </button>
            </div>
            {showNewContact ? (
              <div className="flex gap-2">
                <input aria-label="New contact name" placeholder="Contact name"
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  value={newContactName} onChange={(e) => setNewContactName(e.target.value)} />
                <Button type="button" onClick={() => newContactName.trim() && quickCreateContactM.mutate()}>Create &amp; link</Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <select aria-label="Link a contact"
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  value={selectedContactId} onChange={(e) => setSelectedContactId(e.target.value)}>
                  <option value="">Select a contact…</option>
                  {linkableContacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <Button type="button" disabled={!selectedContactId} onClick={() => selectedContactId && linkContactM.mutate(selectedContactId)}>Link</Button>
              </div>
            )}
          </div>
        )}
```

- [ ] **Step 5: Run to verify pass**

Run: `npm test -- ApplicationDrawer`
Expected: PASS (existing + four new contacts-section tests).

- [ ] **Step 6: Run the full suite (no regressions)**

Run: `npm test`
Expected: PASS — all suites (existing 27 + new ContactDrawer, Contacts, Layout, ApplicationDrawer additions).

- [ ] **Step 7: Commit**

```bash
git add src/api/applications.js src/components/ApplicationDrawer.jsx src/components/ApplicationDrawer.test.jsx
git commit -m "feat(contacts): link/unlink contacts from the application drawer

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

- **Spec coverage:** Contacts sidebar page + nav + route (Task 2) ✓; searchable list with cards incl. followUpDate pill (Task 2) ✓; create/edit/delete via drawer reusing the company picker w/ inline create (Task 1) ✓; client email/URL guards (Task 1) ✓; Application-drawer Contacts section — list linked, link existing, inline quick-create, unlink (Task 3) ✓; invalidate application detail on link/unlink (Task 3) ✓; `contacts.js` API module with all functions (Task 1) ✓; built on DESIGN.md tokens + ui-ux-pro-max (Global Constraints) ✓.
- **Placeholder scan:** none — full code in every step.
- **Type/key consistency:** query keys `['contacts']`, `['contacts', search]`, `['application', id]` used consistently across page, drawer, and invalidations; API fn names (`listContacts`/`createContact`/`updateContact`/`deleteContact`/`linkContact`/`unlinkContact`/`getContact`/`getApplication`) match between `api/*.js`, components, and tests; aria-labels referenced by tests (`Edit <name>`, `Delete <name>`, `Unlink <name>`, `Link a contact`, `New contact name`, `New company name`, `Company`) match the JSX.
- **Regression guard:** Task 3 explicitly updates the existing `ApplicationDrawer.test.jsx` `beforeEach` so the drawer's new edit-mode queries (`GET /applications/:id`, `GET /contacts`) have MSW handlers under `onUnhandledRequest: 'error'`.

## Done When

`npm test` is green (existing 27 + the new Contacts/ContactDrawer/Layout tests + the ApplicationDrawer additions), and `feat/contacts` holds three commits (API+drawer, page+nav+route, application-drawer linking). A user can manage contacts from the sidebar and link them to an application from its drawer.
