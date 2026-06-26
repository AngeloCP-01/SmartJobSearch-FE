import { http, HttpResponse } from 'msw';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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
    http.get(`${API}/documents`, () => HttpResponse.json([])),
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

test('shows the specific field error when the API returns validation details', async () => {
  server.use(http.patch(`${API}/applications/a1`, () => HttpResponse.json({
    error: {
      message: 'Validation failed',
      code: 'VALIDATION',
      details: [{ path: 'source', message: 'String must contain at most 2000 character(s)' }],
    },
  }, { status: 400 })));
  renderDrawer({ application: app });
  await userEvent.clear(screen.getByLabelText(/notes/i));
  await userEvent.type(screen.getByLabelText(/notes/i), 'x');
  await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/source:/i));
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

test('lists and adds interviews for the application, including a scheduled date', async () => {
  const interviews = [{ id: 'iv1', applicationId: 'a1', type: 'HR', interviewer: 'Grace' }];
  let postedBody = null;
  server.use(
    http.get(`${API}/interviews`, ({ request }) => {
      const url = new URL(request.url);
      expect(url.searchParams.get('applicationId')).toBe('a1');
      return HttpResponse.json(interviews);
    }),
    http.post(`${API}/interviews`, async ({ request }) => {
      const b = await request.json();
      postedBody = b;
      expect(b.applicationId).toBe('a1');
      const created = { id: 'iv2', ...b };
      interviews.push(created);
      return HttpResponse.json(created, { status: 201 });
    }),
  );
  renderDrawer({ application: app });
  await waitFor(() => expect(screen.getByText(/Grace/)).toBeInTheDocument());
  await userEvent.selectOptions(screen.getByLabelText(/add interview type/i), 'Technical');
  fireEvent.change(screen.getByLabelText(/add interview scheduled date/i), { target: { value: '2026-06-26T14:00' } });
  await userEvent.click(screen.getByRole('button', { name: /add interview/i }));
  await waitFor(() => expect(screen.getByText('Technical', { selector: 'span' })).toBeInTheDocument());
  expect(postedBody.scheduledAt).toBe('2026-06-26T14:00');
});

test('sets an interview result from the drawer', async () => {
  let patchedBody = null;
  const interviews = [{ id: 'iv1', applicationId: 'a1', type: 'HR', interviewer: 'Grace', result: null }];
  server.use(
    http.get(`${API}/interviews`, () => HttpResponse.json(interviews)),
    http.patch(`${API}/interviews/iv1`, async ({ request }) => {
      patchedBody = await request.json();
      interviews[0] = { ...interviews[0], ...patchedBody };
      return HttpResponse.json(interviews[0]);
    }),
  );
  renderDrawer({ application: app });
  await waitFor(() => expect(screen.getByText(/Grace/)).toBeInTheDocument());
  fireEvent.change(screen.getByLabelText('Result for HR with Grace'), { target: { value: 'Failed' } });
  await waitFor(() => expect(patchedBody).toEqual({ result: 'Failed' }));
  await waitFor(() => expect(screen.getByLabelText('Result for HR with Grace')).toHaveValue('Failed'));
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

test('quick-create surfaces an error when linking fails', async () => {
  server.use(
    http.post(`${API}/contacts`, async ({ request }) => {
      const b = await request.json();
      return HttpResponse.json({ id: 'k9', name: b.name, company: null }, { status: 201 });
    }),
    http.post(`${API}/applications/a1/contacts`, () =>
      HttpResponse.json({ error: { message: 'Link failed', code: 'CONFLICT' } }, { status: 409 })),
  );
  renderDrawer({ application: app });
  await userEvent.click(await screen.findByRole('button', { name: /new contact/i }));
  await userEvent.type(screen.getByLabelText(/new contact name/i), 'Quick Bob');
  await userEvent.click(screen.getByRole('button', { name: /^create & link$/i }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/link failed/i));
});

test('lists and links documents in the application drawer', async () => {
  let linkedId = null;
  server.use(
    http.get(`${API}/documents`, () => HttpResponse.json([
      { id: 'd1', name: 'My Resume', type: 'Resume', originalFilename: 'r.pdf', mimeType: 'application/pdf', sizeBytes: 100 },
    ])),
    http.get(`${API}/applications/a1`, () => HttpResponse.json({
      ...app,
      contacts: [],
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
      contacts: [],
      documents: [{ id: 'd2', name: 'Linked CV', type: 'Resume', originalFilename: 'cv.pdf', mimeType: 'application/pdf', sizeBytes: 50 }],
    })),
    http.delete(`${API}/applications/a1/documents/d2`, () => { unlinked = true; return new HttpResponse(null, { status: 204 }); }),
  );
  renderDrawer({ application: app });
  expect(await screen.findByText('Linked CV')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /unlink linked cv/i }));
  await waitFor(() => expect(unlinked).toBe(true));
});

test('shows the job description as a formatted read view and toggles to edit', async () => {
  const withDesc = { ...app, jobDescription: 'Responsibilities:\n• Build APIs\n• Maintain CI/CD' };
  renderDrawer({ application: withDesc });
  await waitFor(() => expect(screen.getByLabelText(/position/i)).toHaveValue('Backend Eng'));
  // Read view: text is shown, no editable textarea yet.
  expect(screen.queryByPlaceholderText(/paste the job description/i)).not.toBeInTheDocument();
  expect(screen.getByText(/Build APIs/)).toBeInTheDocument();
  // Toggling to edit reveals the textarea with the exact pasted content preserved.
  await userEvent.click(screen.getByRole('button', { name: /^edit$/i }));
  expect(screen.getByPlaceholderText(/paste the job description/i))
    .toHaveValue('Responsibilities:\n• Build APIs\n• Maintain CI/CD');
});

test('new applications open the job description in edit mode', async () => {
  renderDrawer({ application: null });
  expect(await screen.findByPlaceholderText(/paste the job description/i)).toBeInTheDocument();
});

test('expands the job description into a modal and closes it without closing the drawer', async () => {
  const onClose = vi.fn();
  const withDesc = { ...app, jobDescription: 'A long job description with many lines.' };
  renderDrawer({ application: withDesc, onClose });
  await waitFor(() => expect(screen.getByLabelText(/position/i)).toBeInTheDocument());
  await userEvent.click(screen.getByRole('button', { name: /expand job description/i }));
  expect(await screen.findByRole('dialog', { name: /^job description$/i })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /close job description/i }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: /^job description$/i })).not.toBeInTheDocument());
  expect(onClose).not.toHaveBeenCalled();
});

test('auto-fills the new-application form from a pasted posting', async () => {
  server.use(http.post(`${API}/postings/parse`, () => HttpResponse.json({
    position: 'Staff Engineer', companyName: null, salaryMin: 120000, salaryMax: 150000,
    workMode: 'Remote', source: null, jobDescription: 'Build things.\n- Ship code',
  })));
  renderDrawer({ application: null });
  await userEvent.type(screen.getByLabelText('Job posting'), 'Staff Engineer at Acme — pasted posting body');
  await userEvent.click(screen.getByRole('button', { name: /auto-fill/i }));
  await waitFor(() => expect(screen.getByLabelText(/position/i)).toHaveValue('Staff Engineer'));
  expect(screen.getByLabelText(/min salary/i)).toHaveValue(120000);
  expect(screen.getByLabelText(/max salary/i)).toHaveValue(150000);
  expect(screen.getByLabelText('Work mode')).toHaveValue('Remote');
  expect(screen.getByText(/Ship code/)).toBeInTheDocument(); // JD shown in the read view
});

test('edit mode prefills the work mode select', async () => {
  renderDrawer({ application: { ...app, workMode: 'Hybrid' } });
  await waitFor(() => expect(screen.getByLabelText('Work mode')).toHaveValue('Hybrid'));
});

test('shows the backend error inline when a posting cannot be parsed', async () => {
  server.use(http.post(`${API}/postings/parse`, () => HttpResponse.json(
    { error: { message: 'Couldn’t fetch that URL — paste the posting text instead.', code: 'VALIDATION', details: [] } },
    { status: 400 },
  )));
  renderDrawer({ application: null });
  await userEvent.type(screen.getByLabelText('Job posting'), 'https://ph.indeed.com/?vjk=abc');
  await userEvent.click(screen.getByRole('button', { name: /auto-fill/i }));
  expect(await screen.findByText(/paste the posting text instead/i)).toBeInTheDocument();
});

test('auto-fill prefills a new company when it does not match an existing one', async () => {
  server.use(http.post(`${API}/postings/parse`, () => HttpResponse.json({
    position: 'Dev', companyName: 'Globex', salaryMin: null, salaryMax: null, source: null, jobDescription: '',
  })));
  renderDrawer({ application: null });
  await userEvent.type(screen.getByLabelText('Job posting'), 'a posting');
  await userEvent.click(screen.getByRole('button', { name: /auto-fill/i }));
  await waitFor(() => expect(screen.getByLabelText(/new company name/i)).toHaveValue('Globex'));
});

test('shows an "Open posting" link when the source is a URL', async () => {
  const withSource = { ...app, source: 'https://ph.indeed.com/viewjob?jk=abc' };
  renderDrawer({ application: withSource });
  const link = await screen.findByRole('link', { name: /open posting/i });
  expect(link).toHaveAttribute('href', 'https://ph.indeed.com/viewjob?jk=abc');
  expect(link).toHaveAttribute('target', '_blank');
  expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
});

test('hides the "Open posting" link when the source is not a URL', async () => {
  renderDrawer({ application: { ...app, source: 'Referral from a friend' } });
  await waitFor(() => expect(screen.getByLabelText(/position/i)).toBeInTheDocument());
  expect(screen.queryByRole('link', { name: /open posting/i })).not.toBeInTheDocument();
});

test('shows the per-application activity timeline', async () => {
  server.use(
    http.get(`${API}/activity`, ({ request }) => {
      const appId = new URL(request.url).searchParams.get('applicationId');
      if (appId === 'a1') return HttpResponse.json({
        items: [{ id: 'e1', action: 'ApplicationStatusChanged', applicationId: 'a1',
          metadata: { position: 'Backend Eng', from: 'Draft', to: 'Applied' }, createdAt: new Date().toISOString() }],
        nextCursor: null,
      });
      return HttpResponse.json({ items: [], nextCursor: null });
    }),
  );
  renderDrawer({ application: app });
  expect(await screen.findByText('Moved Backend Eng from Draft to Applied')).toBeInTheDocument();
});
