import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { server, API } from '../test/server';
import Editor from './Editor';

const DOCS = [
  { id: 'd1', title: 'Backend Resume', type: 'Resume', applicationId: null, updatedAt: '2026-06-20T10:00:00Z' },
  { id: 'd2', title: 'Cover Letter — Acme', type: 'CoverLetter', applicationId: null, updatedAt: '2026-06-21T10:00:00Z' },
];

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Editor />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

test('lists authored documents with their type', async () => {
  server.use(http.get(`${API}/authored-documents`, () => HttpResponse.json(DOCS)));
  renderPage();
  await waitFor(() => expect(screen.getByText('Backend Resume')).toBeInTheDocument());
  expect(screen.getByText('Cover Letter — Acme')).toBeInTheDocument();
});

test('shows an empty state when there are none', async () => {
  server.use(http.get(`${API}/authored-documents`, () => HttpResponse.json([])));
  renderPage();
  await waitFor(() => expect(screen.getByText(/no documents yet/i)).toBeInTheDocument());
});

test('creating a new document POSTs with the chosen title', async () => {
  let posted = null;
  server.use(
    http.get(`${API}/authored-documents`, () => HttpResponse.json([])),
    http.post(`${API}/authored-documents`, async ({ request }) => {
      posted = await request.json();
      return HttpResponse.json({ id: 'new1', title: posted.title, type: posted.type, applicationId: null, updatedAt: '2026-06-29T00:00:00Z' }, { status: 201 });
    }),
  );
  renderPage();
  await waitFor(() => expect(screen.getByText(/no documents yet/i)).toBeInTheDocument());
  await userEvent.type(screen.getByLabelText(/new document title/i), 'Fresh CV');
  await userEvent.click(screen.getByRole('button', { name: /create document/i }));
  await waitFor(() => expect(posted).not.toBeNull());
  expect(posted.title).toBe('Fresh CV');
});

test('deletes a document', async () => {
  let deleted = false;
  server.use(
    http.get(`${API}/authored-documents`, () => HttpResponse.json(deleted ? [] : DOCS)),
    http.delete(`${API}/authored-documents/d1`, () => { deleted = true; return new HttpResponse(null, { status: 204 }); }),
  );
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  renderPage();
  await waitFor(() => expect(screen.getByText('Backend Resume')).toBeInTheDocument());
  await userEvent.click(screen.getByRole('button', { name: /delete backend resume/i }));
  await waitFor(() => expect(deleted).toBe(true));
});

test('shows an error state when the request fails', async () => {
  server.use(http.get(`${API}/authored-documents`, () => HttpResponse.json({ error: { message: 'boom', code: 'INTERNAL' } }, { status: 500 })));
  renderPage();
  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
});
