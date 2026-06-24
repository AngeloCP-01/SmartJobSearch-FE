import { http, HttpResponse } from 'msw';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server, API } from '../test/server';
import Interviews from './Interviews';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><Interviews /></QueryClientProvider>);
}

test('lists interviews with their type and interviewer', async () => {
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([{ id: 'a1', position: 'Eng' }])),
    http.get(`${API}/interviews`, () => HttpResponse.json([
      { id: 'i1', applicationId: 'a1', type: 'Technical', interviewer: 'Grace' },
    ])),
  );
  renderPage();
  // 'Grace' is unique to the list row; 'Technical' also appears as a <select> option,
  // so target the list pill <span> specifically.
  await waitFor(() => expect(screen.getByText('Grace')).toBeInTheDocument());
  expect(screen.getByText('Technical', { selector: 'span' })).toBeInTheDocument();
});

test('submitting with a scheduled date sends scheduledAt to the API', async () => {
  let postedBody = null;
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([{ id: 'a1', position: 'Eng' }])),
    http.get(`${API}/interviews`, () => HttpResponse.json([])),
    http.post(`${API}/interviews`, async ({ request }) => {
      postedBody = await request.json();
      return HttpResponse.json({ id: 'i1', applicationId: 'a1', type: 'HR' }, { status: 201 });
    }),
  );
  renderPage();
  await waitFor(() => expect(screen.getByRole('option', { name: 'Eng' })).toBeInTheDocument());
  fireEvent.change(screen.getByLabelText('Application'), { target: { value: 'a1' } });
  fireEvent.change(screen.getByLabelText('Scheduled date'), { target: { value: '2026-06-26T14:00' } });
  fireEvent.click(screen.getByRole('button', { name: /add interview/i }));
  await waitFor(() => expect(postedBody).not.toBeNull());
  expect(postedBody.applicationId).toBe('a1');
  expect(postedBody.scheduledAt).toBe('2026-06-26T14:00');
});

test('lists all interviews without sending a bogus applicationId param', async () => {
  let requestedUrl = null;
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([])),
    http.get(`${API}/interviews`, ({ request }) => {
      requestedUrl = new URL(request.url);
      return HttpResponse.json([]);
    }),
  );
  renderPage();
  await waitFor(() => expect(requestedUrl).not.toBeNull());
  // The page lists every interview; React Query's context object must not leak in as
  // applicationId (axios serializes the object as bracketed params: applicationId[client]=...).
  expect(requestedUrl.search).not.toMatch(/applicationId/);
});
