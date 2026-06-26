import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { server, API } from '../test/server';
import Dashboard from './Dashboard';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Dashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

test('shows totals, derived stats, pipeline and upcoming interviews from the summary', async () => {
  server.use(
    http.get(`${API}/dashboard/summary`, () => HttpResponse.json({
      totalApplications: 5,
      byStatus: { Applied: 3, Draft: 2, Offer: 1 },
      upcomingInterviews: [{ id: 'i1', type: 'HR', scheduledAt: '2026-07-01T10:00:00.000Z' }],
    })),
    http.get(`${API}/activity`, () => HttpResponse.json({ items: [], nextCursor: null })),
  );
  renderPage();
  await waitFor(() => expect(screen.getByText('5')).toBeInTheDocument()); // Total
  expect(screen.getByText('In progress')).toBeInTheDocument();
  expect(screen.getByText('Offers')).toBeInTheDocument();
  expect(screen.getByText(/Applied/)).toBeInTheDocument(); // pipeline row
  expect(screen.getByText(/HR/)).toBeInTheDocument(); // upcoming interview
  expect(screen.getByRole('button', { name: /new application/i })).toBeInTheDocument();
});
