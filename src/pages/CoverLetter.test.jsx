import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server, API } from '../test/server';
import CoverLetter, { coverLetterFilename } from './CoverLetter';

test('coverLetterFilename derives the name from the application position', () => {
  expect(coverLetterFilename('Senior Full Stack Engineer')).toBe('Senior Full Stack Engineer-cover-letter.txt');
  expect(coverLetterFilename('Frontend Eng (React)')).toBe('Frontend Eng (React)-cover-letter.txt');
  expect(coverLetterFilename('Dev/Ops: Lead')).toBe('DevOps Lead-cover-letter.txt'); // strips \ / : * ? " < > |
  expect(coverLetterFilename('')).toBe('cover-letter.txt');
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

test('disables Generate when AI is not configured', async () => {
  server.use(http.get(`${API}/analysis/config`, () => HttpResponse.json({ aiAvailable: false })));
  renderPage();
  await waitFor(() => expect(screen.getByRole('button', { name: /generate/i })).toBeDisabled());
});
