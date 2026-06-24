import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';
import { server, API } from '../test/server';
import Layout from './Layout';

function renderLayout() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <MemoryRouter initialEntries={['/']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Layout />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

test('renders a Contacts nav link', () => {
  renderLayout();
  expect(screen.getAllByRole('link', { name: /contacts/i }).length).toBeGreaterThan(0);
});

test('renders an Analytics nav link', () => {
  renderLayout();
  expect(screen.getAllByRole('link', { name: /analytics/i }).length).toBeGreaterThan(0);
});

test('renders a Reminders nav link', () => {
  renderLayout();
  expect(screen.getAllByRole('link', { name: /reminders/i }).length).toBeGreaterThan(0);
});

test('renders a Documents nav link', () => {
  renderLayout();
  expect(screen.getAllByRole('link', { name: /documents/i }).length).toBeGreaterThan(0);
});

test('renders an Activity nav link', () => {
  renderLayout();
  expect(screen.getAllByRole('link', { name: /activity/i }).length).toBeGreaterThan(0);
});

test('shows a badge with the reminders count', async () => {
  server.use(http.get(`${API}/reminders`, () => HttpResponse.json({
    interviews: { upcoming: [], overdue: [] },
    followUps: { due: [], upcoming: [] },
    counts: { total: 3, interviews: 2, followUps: 1 },
  })));
  renderLayout();
  await waitFor(() => expect(screen.getAllByLabelText('3 reminders').length).toBeGreaterThan(0));
});
