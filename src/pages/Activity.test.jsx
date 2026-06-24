import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { server, API } from '../test/server';
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
  server.use(http.get(`${API}/activity`, () => HttpResponse.json({
    items: [ITEM(), ITEM({ id: 'e2', action: 'DocumentLinked', metadata: { position: 'Backend Engineer', name: 'Resume v2' } })],
    nextCursor: null,
  })));
  renderPage();
  await waitFor(() => expect(screen.getByText('Created Backend Engineer')).toBeInTheDocument());
  expect(screen.getByText('Attached Resume v2 to Backend Engineer')).toBeInTheDocument();
});

test('"Load more" fetches the next page with before=', async () => {
  let sawBefore = null;
  server.use(http.get(`${API}/activity`, ({ request }) => {
    const before = new URL(request.url).searchParams.get('before');
    if (!before) return HttpResponse.json({ items: [ITEM({ id: 'p1', metadata: { position: 'First' } })], nextCursor: '2026-06-24T00:00:00.000Z|p1' });
    sawBefore = before;
    return HttpResponse.json({ items: [ITEM({ id: 'p2', metadata: { position: 'Second' } })], nextCursor: null });
  }));
  renderPage();
  await waitFor(() => expect(screen.getByText('Created First')).toBeInTheDocument());
  await userEvent.click(screen.getByRole('button', { name: /load more/i }));
  await waitFor(() => expect(screen.getByText('Created Second')).toBeInTheDocument());
  expect(sawBefore).toBe('2026-06-24T00:00:00.000Z|p1');
});

test('shows an empty state', async () => {
  server.use(http.get(`${API}/activity`, () => HttpResponse.json({ items: [], nextCursor: null })));
  renderPage();
  await waitFor(() => expect(screen.getByText(/no activity yet/i)).toBeInTheDocument());
});

test('shows an error state', async () => {
  server.use(http.get(`${API}/activity`, () =>
    HttpResponse.json({ error: { message: 'boom', code: 'SERVER_ERROR' } }, { status: 500 })));
  renderPage();
  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
});
