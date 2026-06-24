import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { server, API } from '../test/server';
import Documents from './Documents';

const DOCS = [
  { id: 'd1', name: 'Backend Resume v2', type: 'Resume', notes: 'tailored',
    originalFilename: 'resume.pdf', mimeType: 'application/pdf', sizeBytes: 12000 },
];

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Documents />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeAll(() => {
  global.URL.createObjectURL = () => 'blob:mock';
  global.URL.revokeObjectURL = () => {};
});

test('lists documents with their type', async () => {
  server.use(http.get(`${API}/documents`, () => HttpResponse.json(DOCS)));
  renderPage();
  await waitFor(() => expect(screen.getByText('Backend Resume v2')).toBeInTheDocument());
  expect(screen.getByText('Resume', { selector: 'span' })).toBeInTheDocument();
});

test('uploads a document as multipart/form-data', async () => {
  let posted = null;
  server.use(
    http.get(`${API}/documents`, () => HttpResponse.json([])),
    http.post(`${API}/documents`, ({ request }) => {
      posted = { contentType: request.headers.get('content-type') || '' };
      return HttpResponse.json({ id: 'd9', name: 'My CV', type: 'Resume',
        originalFilename: 'cv.pdf', mimeType: 'application/pdf', sizeBytes: 5 }, { status: 201 });
    }),
  );
  renderPage();
  await waitFor(() => expect(screen.getByText(/no documents yet/i)).toBeInTheDocument());
  const file = new File(['pdfbytes'], 'cv.pdf', { type: 'application/pdf' });
  await userEvent.upload(screen.getByLabelText('File'), file);
  await userEvent.type(screen.getByLabelText('Document name'), 'My CV');
  await userEvent.click(screen.getByRole('button', { name: /upload/i }));
  // The request must fire as multipart/form-data (the file + fields are in the body).
  await waitFor(() => expect(posted).not.toBeNull());
  expect(posted.contentType).toContain('multipart/form-data');
});

test('downloads a document via the file endpoint', async () => {
  let downloaded = false;
  server.use(
    http.get(`${API}/documents`, () => HttpResponse.json(DOCS)),
    http.get(`${API}/documents/d1/file`, () => { downloaded = true; return HttpResponse.text('bytes'); }),
  );
  renderPage();
  await waitFor(() => expect(screen.getByText('Backend Resume v2')).toBeInTheDocument());
  await userEvent.click(screen.getByRole('button', { name: /download backend resume v2/i }));
  await waitFor(() => expect(downloaded).toBe(true));
});

test('deletes a document', async () => {
  let deleted = false;
  server.use(
    http.get(`${API}/documents`, () => HttpResponse.json(deleted ? [] : DOCS)),
    http.delete(`${API}/documents/d1`, () => { deleted = true; return new HttpResponse(null, { status: 204 }); }),
  );
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  renderPage();
  await waitFor(() => expect(screen.getByText('Backend Resume v2')).toBeInTheDocument());
  await userEvent.click(screen.getByRole('button', { name: /delete backend resume v2/i }));
  await waitFor(() => expect(deleted).toBe(true));
});

test('shows an empty state when there are no documents', async () => {
  server.use(http.get(`${API}/documents`, () => HttpResponse.json([])));
  renderPage();
  await waitFor(() => expect(screen.getByText(/no documents yet/i)).toBeInTheDocument());
});

test('shows an error state when the request fails', async () => {
  server.use(http.get(`${API}/documents`, () =>
    HttpResponse.json({ error: { message: 'boom', code: 'SERVER_ERROR' } }, { status: 500 })));
  renderPage();
  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
});
