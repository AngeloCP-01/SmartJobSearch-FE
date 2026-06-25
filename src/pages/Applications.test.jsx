import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server, API } from '../test/server';
import api from '../api/client';
import Applications, { moveMutationOptions, sortApps } from './Applications';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><Applications /></QueryClientProvider>);
}

// The view choice is persisted to localStorage; reset it so each test starts on
// the default Kanban board.
beforeEach(() => localStorage.clear());

test('renders a column per status and places cards by status', async () => {
  server.use(http.get(`${API}/applications`, () => HttpResponse.json([
    { id: 'a1', position: 'Backend Eng', status: 'Applied' },
  ])));
  renderPage();
  await waitFor(() => expect(screen.getByText('Backend Eng')).toBeInTheDocument());
  expect(screen.getByRole('heading', { name: 'Applied' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Offer' })).toBeInTheDocument();
});

test('moving a card calls PATCH /:id/status with the target column', async () => {
  let patched = null;
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([{ id: 'a1', position: 'Backend Eng', status: 'Applied' }])),
    http.patch(`${API}/applications/a1/status`, async ({ request }) => {
      patched = await request.json();
      return HttpResponse.json({ id: 'a1', position: 'Backend Eng', status: patched.status });
    }),
  );
  renderPage();
  await waitFor(() => expect(screen.getByText('Backend Eng')).toBeInTheDocument());
  // jsdom can't do real pointer DnD, so test the pure drop-mapping helper:
  const { applyDrop } = await import('./Applications');
  await applyDrop({ activeId: 'a1', overId: 'Offer' }, (id, status) =>
    api.patch(`/applications/${id}/status`, { status }));
  await waitFor(() => expect(patched).toEqual({ status: 'Offer' }));
});

test('cards show the company name and salary chip', async () => {
  server.use(http.get(`${API}/applications`, () => HttpResponse.json([
    { id: 'a1', position: 'Backend Eng', status: 'Applied', company: { id: 'c1', name: 'Acme' }, salaryMin: 90000, salaryMax: 110000 },
  ])));
  renderPage();
  await waitFor(() => expect(screen.getByText('Backend Eng')).toBeInTheDocument());
  expect(screen.getByText('Acme', { selector: 'p' })).toBeInTheDocument(); // card, not the filter <option>
  expect(screen.getByText(/90k/)).toBeInTheDocument();
});

test('cards show the applied date', async () => {
  server.use(http.get(`${API}/applications`, () => HttpResponse.json([
    { id: 'a1', position: 'Backend Eng', status: 'Applied', applicationDate: '2026-06-23T00:00:00.000Z' },
  ])));
  renderPage();
  await waitFor(() => expect(screen.getByText('Backend Eng')).toBeInTheDocument());
  expect(screen.getByText(/Applied 2026-06-23/)).toBeInTheDocument();
});

test('clicking the card body opens the drawer pre-filled', async () => {
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([{ id: 'a1', position: 'Backend Eng', status: 'Applied', company: null }])),
    http.get(`${API}/applications/a1`, () => HttpResponse.json({ id: 'a1', position: 'Backend Eng', status: 'Applied', company: null, contacts: [] })),
    http.get(`${API}/companies`, () => HttpResponse.json([])),
    http.get(`${API}/interviews`, () => HttpResponse.json([])),
    http.get(`${API}/contacts`, () => HttpResponse.json([])),
  );
  renderPage();
  await userEvent.click(await screen.findByText('Backend Eng'));
  await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
  expect(screen.getByLabelText(/position/i)).toHaveValue('Backend Eng');
});

test('clicking a card open button opens the drawer pre-filled', async () => {
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([{ id: 'a1', position: 'Backend Eng', status: 'Applied', company: null }])),
    http.get(`${API}/applications/a1`, () => HttpResponse.json({ id: 'a1', position: 'Backend Eng', status: 'Applied', company: null, contacts: [] })),
    http.get(`${API}/companies`, () => HttpResponse.json([])),
    http.get(`${API}/interviews`, () => HttpResponse.json([])),
    http.get(`${API}/contacts`, () => HttpResponse.json([])),
  );
  renderPage();
  await waitFor(() => expect(screen.getByText('Backend Eng')).toBeInTheDocument());
  await userEvent.click(screen.getByRole('button', { name: /open backend eng/i }));
  await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
  expect(screen.getByLabelText(/position/i)).toHaveValue('Backend Eng');
});

test('search filters the board by position', async () => {
  server.use(http.get(`${API}/applications`, () => HttpResponse.json([
    { id: 'a1', position: 'Backend Eng', status: 'Applied' },
    { id: 'a2', position: 'Frontend Eng', status: 'Applied' },
  ])));
  renderPage();
  await waitFor(() => expect(screen.getByText('Backend Eng')).toBeInTheDocument());
  expect(screen.getByText('Frontend Eng')).toBeInTheDocument();
  await userEvent.type(screen.getByPlaceholderText(/search applications/i), 'front');
  await waitFor(() => expect(screen.queryByText('Backend Eng')).not.toBeInTheDocument());
  expect(screen.getByText('Frontend Eng')).toBeInTheDocument();
});

test('sortApps orders by the given key and direction without mutating input', () => {
  const apps = [
    { position: 'B', salaryMax: 100 },
    { position: 'A', salaryMax: 300 },
    { position: 'C', salaryMax: 200 },
  ];
  expect(sortApps(apps, { key: 'position', dir: 'asc' }).map((a) => a.position)).toEqual(['A', 'B', 'C']);
  expect(sortApps(apps, { key: 'position', dir: 'desc' }).map((a) => a.position)).toEqual(['C', 'B', 'A']);
  expect(sortApps(apps, { key: 'salary', dir: 'asc' }).map((a) => a.salaryMax)).toEqual([100, 200, 300]);
  expect(apps.map((a) => a.position)).toEqual(['B', 'A', 'C']); // original untouched
});

test('List view shows applications in a table with a sortable header and status dropdown', async () => {
  server.use(http.get(`${API}/applications`, () => HttpResponse.json([
    { id: 'a1', position: 'Backend Eng', status: 'Applied', company: { id: 'c1', name: 'Acme' }, salaryMin: 90000, salaryMax: 110000, applicationDate: '2026-06-23T00:00:00.000Z' },
  ])));
  renderPage();
  await waitFor(() => expect(screen.getByText('Backend Eng')).toBeInTheDocument());
  await userEvent.click(screen.getByRole('button', { name: /^list$/i }));
  expect(screen.getByRole('button', { name: /sort by position/i })).toBeInTheDocument();
  expect(screen.getByText('Acme', { selector: 'td' })).toBeInTheDocument(); // cell, not the filter <option>
  expect(screen.getByText(/90k/)).toBeInTheDocument();
  expect(screen.getByLabelText('Status for Backend Eng')).toHaveValue('Applied');
});

test('changing status from the List view PATCHes /:id/status', async () => {
  let patched = null;
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([{ id: 'a1', position: 'Backend Eng', status: 'Applied' }])),
    http.patch(`${API}/applications/a1/status`, async ({ request }) => {
      patched = await request.json();
      return HttpResponse.json({ id: 'a1', position: 'Backend Eng', status: patched.status });
    }),
  );
  renderPage();
  await waitFor(() => expect(screen.getByText('Backend Eng')).toBeInTheDocument());
  await userEvent.click(screen.getByRole('button', { name: /^list$/i }));
  await userEvent.selectOptions(screen.getByLabelText('Status for Backend Eng'), 'Offer');
  await waitFor(() => expect(patched).toEqual({ status: 'Offer' }));
});

test('remembers the selected view across remounts (localStorage)', async () => {
  server.use(http.get(`${API}/applications`, () => HttpResponse.json([{ id: 'a1', position: 'Backend Eng', status: 'Applied' }])));
  const { unmount } = renderPage();
  await waitFor(() => expect(screen.getByText('Backend Eng')).toBeInTheDocument());
  await userEvent.click(screen.getByRole('button', { name: /^list$/i }));
  expect(localStorage.getItem('applicationsView')).toBe('list');
  unmount();
  renderPage();
  await waitFor(() => expect(screen.getByLabelText('Status for Backend Eng')).toBeInTheDocument());
});

test('filters applications by status', async () => {
  server.use(http.get(`${API}/applications`, () => HttpResponse.json([
    { id: 'a1', position: 'Backend Eng', status: 'Applied', company: null },
    { id: 'a2', position: 'Frontend Eng', status: 'Offer', company: null },
  ])));
  renderPage();
  await waitFor(() => expect(screen.getByText('Backend Eng')).toBeInTheDocument());
  expect(screen.getByText('Frontend Eng')).toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText(/filter by status/i), 'Offer');
  await waitFor(() => expect(screen.queryByText('Backend Eng')).not.toBeInTheDocument());
  expect(screen.getByText('Frontend Eng')).toBeInTheDocument();
});

test('filters applications by company', async () => {
  server.use(http.get(`${API}/applications`, () => HttpResponse.json([
    { id: 'a1', position: 'Backend Eng', status: 'Applied', company: { id: 'c1', name: 'Acme' } },
    { id: 'a2', position: 'Frontend Eng', status: 'Applied', company: { id: 'c2', name: 'Globex' } },
  ])));
  renderPage();
  await waitFor(() => expect(screen.getByText('Backend Eng')).toBeInTheDocument());
  await userEvent.selectOptions(screen.getByLabelText(/filter by company/i), 'c1');
  await waitFor(() => expect(screen.queryByText('Frontend Eng')).not.toBeInTheDocument());
  expect(screen.getByText('Backend Eng')).toBeInTheDocument();
});

test('Clear resets the active filters', async () => {
  server.use(http.get(`${API}/applications`, () => HttpResponse.json([
    { id: 'a1', position: 'Backend Eng', status: 'Applied', company: null },
    { id: 'a2', position: 'Frontend Eng', status: 'Offer', company: null },
  ])));
  renderPage();
  await waitFor(() => expect(screen.getByText('Backend Eng')).toBeInTheDocument());
  await userEvent.selectOptions(screen.getByLabelText(/filter by status/i), 'Offer');
  await waitFor(() => expect(screen.queryByText('Backend Eng')).not.toBeInTheDocument());
  await userEvent.click(screen.getByRole('button', { name: /^clear$/i }));
  await waitFor(() => expect(screen.getByText('Backend Eng')).toBeInTheDocument());
  expect(screen.getByText('Frontend Eng')).toBeInTheDocument();
});

test('has no redundant quick-add "Add application" button', async () => {
  server.use(http.get(`${API}/applications`, () => HttpResponse.json([])));
  renderPage();
  await waitFor(() => expect(screen.getByRole('button', { name: /new application/i })).toBeInTheDocument());
  expect(screen.queryByRole('button', { name: /add application/i })).not.toBeInTheDocument();
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

test('move optimistically updates the cache and rolls back on error', async () => {
  const qc = new QueryClient();
  qc.setQueryData(['applications'], [{ id: 'a1', position: 'X', status: 'Applied' }]);
  const opts = moveMutationOptions(qc);

  const ctx = await opts.onMutate({ id: 'a1', status: 'Offer' });
  expect(qc.getQueryData(['applications'])[0].status).toBe('Offer'); // optimistic move

  opts.onError(new Error('fail'), { id: 'a1', status: 'Offer' }, ctx);
  expect(qc.getQueryData(['applications'])[0].status).toBe('Applied'); // rolled back
});
