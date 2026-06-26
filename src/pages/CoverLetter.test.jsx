import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server, API } from '../test/server';
import CoverLetter, { coverLetterFilename } from './CoverLetter';
import { createDocument, linkDocument } from '../api/documents';

// Keep the real listDocuments (drives the Résumé dropdown via MSW); mock only
// the write calls so "Save to Documents" can be asserted without a flaky
// multipart round-trip through jsdom.
vi.mock('../api/documents', async (importActual) => ({
  ...(await importActual()),
  createDocument: vi.fn(),
  linkDocument: vi.fn(),
}));

test('coverLetterFilename derives the name from the position + company', () => {
  expect(coverLetterFilename('Senior Full Stack Engineer', 'Northwind Cloud'))
    .toBe('Senior Full Stack Engineer - Northwind Cloud-cover-letter.txt');
  expect(coverLetterFilename('Frontend Eng (React)', '')).toBe('Frontend Eng (React)-cover-letter.txt');
  expect(coverLetterFilename('Dev/Ops: Lead', 'Acme/Co')).toBe('DevOps Lead - AcmeCo-cover-letter.txt'); // strips \ / : * ? " < > |
  expect(coverLetterFilename('Engineer', 'the company')).toBe('Engineer-cover-letter.txt'); // omits placeholder
  expect(coverLetterFilename('', '')).toBe('cover-letter.txt');
});

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><CoverLetter /></QueryClientProvider>);
}

beforeEach(() => {
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([{ id: 'a1', position: 'Backend Engineer', status: 'Applied' }])),
    http.get(`${API}/documents`, () => HttpResponse.json([{ id: 'd1', name: 'My Resume', type: 'Resume' }])),
    http.get(`${API}/analysis/config`, () => HttpResponse.json({ aiAvailable: true })),
    http.get(`${API}/applications/a1`, () => HttpResponse.json({ id: 'a1', position: 'Backend Engineer', jobDescription: 'Node.js role' })),
  );
});

test('generates a cover letter and shows it in an editable field', async () => {
  let posted = null;
  server.use(http.post(`${API}/analysis/cover-letter`, async ({ request }) => {
    posted = await request.json();
    return HttpResponse.json({
      coverLetter: 'Dear Hiring Team, I am excited to apply…',
      meta: { position: 'Backend Engineer', companyName: 'Acme', documentName: 'My Resume', model: 'test/model:free' },
    }, { status: 201 });
  }));
  renderPage();
  await screen.findByRole('option', { name: 'Backend Engineer' }); // wait for queries to load options
  await screen.findByRole('option', { name: 'My Resume' });
  await userEvent.selectOptions(screen.getByLabelText('Application'), 'a1');
  await userEvent.selectOptions(screen.getByLabelText('Résumé'), 'd1');
  await userEvent.click(screen.getByRole('button', { name: /generate/i }));
  await waitFor(() => expect(posted).toEqual({ applicationId: 'a1', documentId: 'd1' }));
  expect(await screen.findByLabelText('Cover letter')).toHaveValue('Dear Hiring Team, I am excited to apply…');
});

test('saves the generated letter as a CoverLetter document linked to the application', async () => {
  createDocument.mockReset().mockResolvedValue({ id: 'doc9', name: 'Cover Letter — Backend Engineer', type: 'CoverLetter' });
  linkDocument.mockReset().mockResolvedValue({});
  server.use(http.post(`${API}/analysis/cover-letter`, () => HttpResponse.json({
    coverLetter: 'Dear Hiring Team, I am excited…',
    meta: { position: 'Backend Engineer', companyName: 'Acme', documentName: 'My Resume', model: 'm' },
  }, { status: 201 })));
  renderPage();
  await screen.findByRole('option', { name: 'Backend Engineer' });
  await screen.findByRole('option', { name: 'My Resume' });
  await userEvent.selectOptions(screen.getByLabelText('Application'), 'a1');
  await userEvent.selectOptions(screen.getByLabelText('Résumé'), 'd1');
  await userEvent.click(screen.getByRole('button', { name: /generate/i }));
  await screen.findByLabelText('Cover letter');
  await userEvent.click(screen.getByRole('button', { name: /save to documents/i }));
  await waitFor(() => expect(createDocument).toHaveBeenCalled());
  const fd = createDocument.mock.calls[0][0];
  expect(fd.get('type')).toBe('CoverLetter');
  expect(fd.get('name')).toBe('Cover Letter — Backend Engineer');
  expect(fd.get('file').name).toBe('Backend Engineer - Acme-cover-letter.txt');
  await waitFor(() => expect(linkDocument).toHaveBeenCalledWith('a1', 'doc9'));
});

test('disables Generate when AI is not configured', async () => {
  server.use(http.get(`${API}/analysis/config`, () => HttpResponse.json({ aiAvailable: false })));
  renderPage();
  await waitFor(() => expect(screen.getByRole('button', { name: /generate/i })).toBeDisabled());
});
