import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server, API } from '../test/server';
import Dashboard from './Dashboard';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><Dashboard /></QueryClientProvider>);
}

test('shows totals and status breakdown from the summary', async () => {
  server.use(http.get(`${API}/dashboard/summary`, () => HttpResponse.json({
    totalApplications: 5,
    byStatus: { Applied: 3, Draft: 2 },
    upcomingInterviews: [{ id: 'i1', type: 'HR', scheduledAt: '2026-07-01T10:00:00.000Z' }],
  })));
  renderPage();
  await waitFor(() => expect(screen.getByText('5')).toBeInTheDocument());
  expect(screen.getByText(/Applied/)).toBeInTheDocument();
  expect(screen.getByText(/HR/)).toBeInTheDocument();
});
