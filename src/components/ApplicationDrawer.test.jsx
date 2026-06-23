import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server, API } from '../test/server';
import ApplicationDrawer from './ApplicationDrawer';

function renderDrawer(props = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ApplicationDrawer open onClose={props.onClose || (() => {})} application={props.application ?? null} />
    </QueryClientProvider>,
  );
}

const app = {
  id: 'a1', position: 'Backend Eng', companyId: null, company: null, status: 'Applied',
  salaryMin: null, salaryMax: null, source: '', jobDescription: '', notes: 'hi',
};

beforeEach(() => {
  server.use(
    http.get(`${API}/companies`, () => HttpResponse.json([{ id: 'c1', name: 'Acme' }])),
    http.get(`${API}/interviews`, () => HttpResponse.json([])),
    http.get(`${API}/applications/a1`, () => HttpResponse.json({ ...app, contacts: [] })),
    http.get(`${API}/contacts`, () => HttpResponse.json([])),
  );
});

test('edit mode pre-fills the form from the application', async () => {
  renderDrawer({ application: app });
  await waitFor(() => expect(screen.getByLabelText(/position/i)).toHaveValue('Backend Eng'));
  expect(screen.getByLabelText(/notes/i)).toHaveValue('hi');
});

test('edit mode selects the linked company (from companyId or nested company.id)', async () => {
  const linked = { ...app, companyId: 'c1', company: { id: 'c1', name: 'Acme' } };
  renderDrawer({ application: linked });
  await waitFor(() => expect(screen.getByRole('combobox', { name: /company/i })).toHaveValue('c1'));
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
  await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
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
  await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(body.position).toBe('Frontend Eng');
});

test('blocks save when salary min exceeds max', async () => {
  let patched = false;
  server.use(http.patch(`${API}/applications/a1`, () => { patched = true; return HttpResponse.json(app); }));
  renderDrawer({ application: app });
  await userEvent.type(screen.getByLabelText(/min salary/i), '100');
  await userEvent.type(screen.getByLabelText(/max salary/i), '50');
  await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
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
  renderDrawer({ application: app });
  await userEvent.click(screen.getByRole('button', { name: /new company/i }));
  await userEvent.type(screen.getByLabelText(/new company name/i), 'Globex');
  await userEvent.click(screen.getByRole('button', { name: /^add$/i }));
  await waitFor(() => expect(screen.getByRole('combobox', { name: /company/i })).toHaveValue('c-new'));
});

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
      expect(b.applicationId).toBe('a1');
      const created = { id: 'iv2', ...b };
      interviews.push(created);
      return HttpResponse.json(created, { status: 201 });
    }),
  );
  renderDrawer({ application: app });
  await waitFor(() => expect(screen.getByText(/Grace/)).toBeInTheDocument());
  await userEvent.selectOptions(screen.getByLabelText(/add interview type/i), 'Technical');
  await userEvent.click(screen.getByRole('button', { name: /add interview/i }));
  await waitFor(() => expect(screen.getByText('Technical', { selector: 'span' })).toBeInTheDocument());
});

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
  await screen.findByRole('option', { name: 'Jane Recruiter' });
  await userEvent.selectOptions(screen.getByLabelText(/link a contact/i), 'k1');
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
