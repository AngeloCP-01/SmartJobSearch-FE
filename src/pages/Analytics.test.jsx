import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server, API } from '../test/server';
import Analytics from './Analytics';

const FUNNEL = [
  'Draft', 'Applied', 'HR_Screening', 'Technical_Interview',
  'Final_Interview', 'Offer', 'Accepted', 'Rejected', 'Withdrawn',
].map((status) => ({ status, count: 0 }));
const OVERTIME = Array.from({ length: 12 }, (_, i) => ({
  month: `2026-${String(i + 1).padStart(2, '0')}`, count: 0,
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><Analytics /></QueryClientProvider>);
}

test('renders headline metrics from the analytics payload', async () => {
  server.use(http.get(`${API}/analytics`, () => HttpResponse.json({
    metrics: { totalApplications: 42, interviewRate: 0.45, offerRate: 0.07, rejectionRate: 0.19 },
    funnel: FUNNEL, overTime: OVERTIME,
  })));
  renderPage();
  await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument());
  expect(screen.getByText('45%')).toBeInTheDocument();
  expect(screen.getByText('7%')).toBeInTheDocument();
  expect(screen.getByText('19%')).toBeInTheDocument();
});

test('shows a loading state while fetching', () => {
  server.use(http.get(`${API}/analytics`, () => HttpResponse.json({
    metrics: { totalApplications: 0, interviewRate: 0, offerRate: 0, rejectionRate: 0 },
    funnel: FUNNEL, overTime: OVERTIME,
  })));
  renderPage();
  expect(screen.getByText('Loading…')).toBeInTheDocument();
});

test('shows an empty state when there are no applications', async () => {
  server.use(http.get(`${API}/analytics`, () => HttpResponse.json({
    metrics: { totalApplications: 0, interviewRate: 0, offerRate: 0, rejectionRate: 0 },
    funnel: FUNNEL, overTime: OVERTIME,
  })));
  renderPage();
  await waitFor(() =>
    expect(screen.getByText(/add applications to see analytics/i)).toBeInTheDocument());
});

test('shows an error state when the request fails', async () => {
  server.use(http.get(`${API}/analytics`, () =>
    HttpResponse.json({ error: { message: 'boom', code: 'SERVER_ERROR' } }, { status: 500 })));
  renderPage();
  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
});
