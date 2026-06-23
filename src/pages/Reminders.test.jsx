import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { server, API } from '../test/server';
import Reminders from './Reminders';

const PAYLOAD = {
  interviews: {
    upcoming: [{ id: 'i1', type: 'Technical', scheduledAt: '2026-06-25T14:00:00.000Z', result: null,
      application: { id: 'a1', position: 'Backend Engineer', company: { id: 'c1', name: 'Acme' } } }],
    overdue: [{ id: 'i2', type: 'HR', scheduledAt: '2026-06-20T10:00:00.000Z', result: null,
      application: { id: 'a2', position: 'Frontend Dev', company: null } }],
  },
  followUps: {
    due: [{ id: 'ct1', name: 'Jane Recruiter', position: 'Recruiter',
      followUpDate: '2026-06-20T00:00:00.000Z', company: { id: 'c1', name: 'Acme' } }],
    upcoming: [{ id: 'ct2', name: 'Bob Hiring', position: 'EM',
      followUpDate: '2026-06-26T00:00:00.000Z', company: null }],
  },
  counts: { total: 4, interviews: 2, followUps: 2 },
};
const EMPTY = {
  interviews: { upcoming: [], overdue: [] },
  followUps: { due: [], upcoming: [] },
  counts: { total: 0, interviews: 0, followUps: 0 },
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Reminders />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

test('renders interview and follow-up reminders', async () => {
  server.use(http.get(`${API}/reminders`, () => HttpResponse.json(PAYLOAD)));
  renderPage();
  await waitFor(() => expect(screen.getByText(/Backend Engineer/)).toBeInTheDocument());
  expect(screen.getByText('Frontend Dev')).toBeInTheDocument();
  expect(screen.getByText('Jane Recruiter')).toBeInTheDocument();
  expect(screen.getByText('Bob Hiring')).toBeInTheDocument();
  expect(screen.getAllByText(/overdue/i).length).toBeGreaterThan(0);
});

test('Mark done clears the follow-up via PATCH', async () => {
  let patchedBody = null;
  server.use(
    http.get(`${API}/reminders`, () => HttpResponse.json(PAYLOAD)),
    http.patch(`${API}/contacts/ct1`, async ({ request }) => {
      patchedBody = await request.json();
      return HttpResponse.json({ id: 'ct1', name: 'Jane Recruiter', followUpDate: null });
    }),
  );
  renderPage();
  await waitFor(() => expect(screen.getByText('Jane Recruiter')).toBeInTheDocument());
  await userEvent.click(screen.getByRole('button', { name: /mark follow-up with jane recruiter done/i }));
  await waitFor(() => expect(patchedBody).toEqual({ followUpDate: null }));
});

test('shows an empty state when there are no reminders', async () => {
  server.use(http.get(`${API}/reminders`, () => HttpResponse.json(EMPTY)));
  renderPage();
  await waitFor(() => expect(screen.getByText(/all caught up/i)).toBeInTheDocument());
});

test('shows a loading state while fetching', () => {
  server.use(http.get(`${API}/reminders`, () => HttpResponse.json(EMPTY)));
  renderPage();
  expect(screen.getByText('Loading…')).toBeInTheDocument();
});

test('shows an error state when the request fails', async () => {
  server.use(http.get(`${API}/reminders`, () =>
    HttpResponse.json({ error: { message: 'boom', code: 'SERVER_ERROR' } }, { status: 500 })));
  renderPage();
  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
});
