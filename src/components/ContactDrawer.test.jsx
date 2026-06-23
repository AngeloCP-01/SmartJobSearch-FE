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
