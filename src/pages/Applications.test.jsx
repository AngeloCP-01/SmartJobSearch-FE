import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server, API } from '../test/server';
import api from '../api/client';
import Applications from './Applications';

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
