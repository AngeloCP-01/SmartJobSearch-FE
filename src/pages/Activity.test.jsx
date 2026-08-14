import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { server, API, API_V2 } from '../test/server';
import Activity from './Activity';

const ITEM = (over) => ({
  id: 'e1', action: 'ApplicationCreated', applicationId: 'a1',
  metadata: { position: 'Backend Engineer' }, createdAt: new Date().toISOString(), ...over,
});

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Activity />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

test('renders activity events', async () => {
  server.use(http.get(`${API_V2}/activity`, () => HttpResponse.json({
    items: [ITEM(), ITEM({ id: 'e2', action: 'DocumentLinked', metadata: { position: 'Backend Engineer', name: 'Resume v2' } })],
    pageSize: 25, nextCursor: null,
  })));
  renderPage();
  await waitFor(() => expect(screen.getByText('Created Backend Engineer')).toBeInTheDocument());
  expect(screen.getByText('Attached Resume v2 to Backend Engineer')).toBeInTheDocument();
});

test('"Load more" fetches the next page with before=', async () => {
  let sawBefore = null;
  server.use(http.get(`${API_V2}/activity`, ({ request }) => {
    const before = new URL(request.url).searchParams.get('before');
    if (!before) return HttpResponse.json({ items: [ITEM({ id: 'p1', metadata: { position: 'First' } })], pageSize: 25, nextCursor: '2026-06-24T00:00:00.000Z|p1' });
    sawBefore = before;
    return HttpResponse.json({ items: [ITEM({ id: 'p2', metadata: { position: 'Second' } })], pageSize: 25, nextCursor: null });
  }));
  renderPage();
  await waitFor(() => expect(screen.getByText('Created First')).toBeInTheDocument());
  await userEvent.click(screen.getByRole('button', { name: /load more/i }));
  await waitFor(() => expect(screen.getByText('Created Second')).toBeInTheDocument());
  expect(sawBefore).toBe('2026-06-24T00:00:00.000Z|p1');
});

test('shows an empty state', async () => {
  server.use(http.get(`${API_V2}/activity`, () => HttpResponse.json({ items: [], pageSize: 25, nextCursor: null })));
  renderPage();
  await waitFor(() => expect(screen.getByText(/no activity yet/i)).toBeInTheDocument());
});

test('shows an error state', async () => {
  server.use(http.get(`${API_V2}/activity`, () =>
    HttpResponse.json({ error: { message: 'boom', code: 'SERVER_ERROR' } }, { status: 500 })));
  renderPage();
  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
});

test('asks v2 for an allowlisted pageSize and keeps the cursor pager', async () => {
  let seen = null;
  server.use(http.get(`${API_V2}/activity`, ({ request }) => {
    seen = Object.fromEntries(new URL(request.url).searchParams);
    return HttpResponse.json({ items: [ITEM()], pageSize: 25, nextCursor: null });
  }));
  renderPage();
  await waitFor(() => expect(screen.getByText('Created Backend Engineer')).toBeInTheDocument());
  // v2 renamed limit → pageSize and validates it instead of clamping.
  expect(seen).toEqual({ pageSize: '25' });
  // A numbered pager over an append-only feed re-serves rows: row 25 becomes
  // row 26 the moment a new event lands.
  expect(screen.queryByRole('navigation', { name: /pagination/i })).not.toBeInTheDocument();
});
