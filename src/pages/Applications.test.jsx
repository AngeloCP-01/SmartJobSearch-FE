import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server, API } from '../test/server';
import api from '../api/client';
import Applications, { moveMutationOptions } from './Applications';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><Applications /></QueryClientProvider>);
}

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
  expect(screen.getByText('Acme')).toBeInTheDocument();
  expect(screen.getByText(/90k/)).toBeInTheDocument();
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
