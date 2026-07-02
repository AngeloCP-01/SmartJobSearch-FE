import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { server, API } from '../test/server';
import Documents from './Documents';
import { createAuthoredDocument } from '../api/authoredDocuments';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig()),
  useNavigate: () => navigateMock,
}));
vi.mock('../api/authoredDocuments', () => ({ createAuthoredDocument: vi.fn() }));

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

test('shows the chosen file name and prefills the document name', async () => {
  server.use(http.get(`${API}/documents`, () => HttpResponse.json([])));
  renderPage();
  await waitFor(() => expect(screen.getByText(/no documents yet/i)).toBeInTheDocument());
  const file = new File(['pdfbytes'], 'Backend_Resume.pdf', { type: 'application/pdf' });
  await userEvent.upload(screen.getByLabelText('File'), file);
  // The selected file is clearly shown (the original UX gap), and the name field
  // is prefilled from the filename without its extension.
  expect(screen.getByText('Backend_Resume.pdf')).toBeInTheDocument();
  expect(screen.getByLabelText('Document name')).toHaveValue('Backend_Resume');
  // Removing the file clears the chosen-file display.
  await userEvent.click(screen.getByRole('button', { name: /remove file/i }));
  expect(screen.queryByText('Backend_Resume.pdf')).not.toBeInTheDocument();
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

test('shows an error if a download fails', async () => {
  server.use(
    http.get(`${API}/documents`, () => HttpResponse.json(DOCS)),
    http.get(`${API}/documents/d1/file`, () =>
      HttpResponse.json({ error: { message: 'boom', code: 'SERVER_ERROR' } }, { status: 500 })),
  );
  renderPage();
  await waitFor(() => expect(screen.getByText('Backend Resume v2')).toBeInTheDocument());
  await userEvent.click(screen.getByRole('button', { name: /download backend resume v2/i }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/could not download/i));
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

const OPENABLE_DOCS = [
  { id: 'd1', name: 'Resume PDF', type: 'Resume', originalFilename: 'resume.pdf', mimeType: 'application/pdf', sizeBytes: 1000 },
  { id: 'd2', name: 'Legacy Doc', type: 'Other', originalFilename: 'old.doc', mimeType: 'application/msword', sizeBytes: 1000 },
];

test('shows "Open in Editor" only for supported types', async () => {
  server.use(http.get(`${API}/documents`, () => HttpResponse.json(OPENABLE_DOCS)));
  renderPage();
  await waitFor(() => expect(screen.getByText('Resume PDF')).toBeInTheDocument());
  expect(screen.getByRole('button', { name: /open resume pdf in editor/i })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /open legacy doc in editor/i })).not.toBeInTheDocument();
});

test('Open in Editor creates an authored document and navigates to it', async () => {
  navigateMock.mockReset();
  createAuthoredDocument.mockReset().mockResolvedValue({ id: 'ad9' });
  server.use(
    http.get(`${API}/documents`, () => HttpResponse.json([OPENABLE_DOCS[0]])),
    http.get(`${API}/documents/d1/text`, () => HttpResponse.json({ ok: true, text: 'Backend engineer resume text.' })),
  );
  renderPage();
  await waitFor(() => expect(screen.getByText('Resume PDF')).toBeInTheDocument());

  await userEvent.click(screen.getByRole('button', { name: /open resume pdf in editor/i }));

  await waitFor(() => expect(createAuthoredDocument).toHaveBeenCalled());
  const body = createAuthoredDocument.mock.calls[0][0];
  expect(body.title).toBe('Resume PDF');
  expect(body.type).toBe('Resume');
  expect(body.content.type).toBe('doc');
  await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/editor/ad9'));
});

test('Open in Editor shows an error when no text can be extracted', async () => {
  createAuthoredDocument.mockReset();
  server.use(
    http.get(`${API}/documents`, () => HttpResponse.json([OPENABLE_DOCS[0]])),
    http.get(`${API}/documents/d1/text`, () => HttpResponse.json({ ok: false, text: '' })),
  );
  renderPage();
  await waitFor(() => expect(screen.getByText('Resume PDF')).toBeInTheDocument());

  await userEvent.click(screen.getByRole('button', { name: /open resume pdf in editor/i }));

  await waitFor(() => expect(screen.getByText(/no selectable text found/i)).toBeInTheDocument());
  expect(createAuthoredDocument).not.toHaveBeenCalled();
});
