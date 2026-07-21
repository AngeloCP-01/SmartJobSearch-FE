import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { server, API } from '../test/server';
import Analysis from './Analysis';
import { trackEvent } from '../observability/analytics';

vi.mock('../observability/analytics', () => ({ trackEvent: vi.fn() }));

beforeEach(() => { trackEvent.mockClear(); });

const REPORT = {
  meta: { documentName: 'Backend Resume', position: 'Backend Engineer', jdPresent: true, extractionOk: true, wordCount: 600 },
  atsSubScores: { parseability: 90, sections: 80, contactInfo: 100, formatting: 70, length: 100 },
  matched: [{ term: 'node.js', type: 'hard', jdCount: 4, resumeCount: 3, weight: 8 }],
  missing: [{ term: 'kubernetes', type: 'hard', jdCount: 3, resumeCount: 0, weight: 6 }],
  sectionFindings: [], suggestions: [{ text: 'Add "Kubernetes".', severity: 'high', source: 'rule' }],
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Analysis />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

test('runs an analysis and renders the report', async () => {
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([{ id: 'a1', position: 'Backend Engineer' }])),
    http.get(`${API}/applications/a1`, () => HttpResponse.json({ id: 'a1', position: 'Backend Engineer', jobDescription: 'Node.js' })),
    http.get(`${API}/documents`, () => HttpResponse.json([{ id: 'd1', name: 'Backend Resume', type: 'Resume', originalFilename: 'r.pdf', mimeType: 'application/pdf', sizeBytes: 1 }])),
    http.get(`${API}/analysis`, () => HttpResponse.json([])),
    http.post(`${API}/analysis`, () => HttpResponse.json({ id: 'an1', atsScore: 82, matchScore: 67, report: REPORT, createdAt: new Date().toISOString() }, { status: 201 })),
  );
  renderPage();
  await waitFor(() => expect(screen.getByRole('option', { name: /Backend Engineer/ })).toBeInTheDocument());
  await userEvent.selectOptions(screen.getByLabelText(/application/i), 'a1');
  await userEvent.selectOptions(screen.getByLabelText(/résumé|resume/i), 'd1');
  await userEvent.click(screen.getByRole('button', { name: /run analysis/i }));
  await waitFor(() => expect(screen.getByLabelText(/ATS-friendliness score/i)).toHaveTextContent('82'));
  expect(screen.getByText(/kubernetes/)).toBeInTheDocument();
});

test('renders a history list', async () => {
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([])),
    http.get(`${API}/documents`, () => HttpResponse.json([])),
    http.get(`${API}/analysis`, () => HttpResponse.json([
      { id: 'an1', atsScore: 82, matchScore: 67, documentName: 'Backend Resume', position: 'Backend Engineer', createdAt: new Date().toISOString() },
    ])),
  );
  renderPage();
  await waitFor(() => expect(screen.getByText('Backend Resume')).toBeInTheDocument());
});

test('shows the no-job-description note when the selected application has no JD', async () => {
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([{ id: 'a1', position: 'Backend Engineer' }])),
    http.get(`${API}/applications/a1`, () => HttpResponse.json({ id: 'a1', position: 'Backend Engineer', jobDescription: null })),
    http.get(`${API}/documents`, () => HttpResponse.json([])),
    http.get(`${API}/analysis`, () => HttpResponse.json([])),
  );
  renderPage();
  await waitFor(() => expect(screen.getByRole('option', { name: /Backend Engineer/ })).toBeInTheDocument());
  await userEvent.selectOptions(screen.getByLabelText(/application/i), 'a1');
  await waitFor(() => expect(screen.getByText(/no job description/i)).toBeInTheDocument());
});

test('shows an error banner if the run fails', async () => {
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([{ id: 'a1', position: 'Backend Engineer' }])),
    http.get(`${API}/applications/a1`, () => HttpResponse.json({ id: 'a1', position: 'Backend Engineer', jobDescription: 'Node.js' })),
    http.get(`${API}/documents`, () => HttpResponse.json([{ id: 'd1', name: 'Backend Resume', type: 'Resume', originalFilename: 'r.pdf', mimeType: 'application/pdf', sizeBytes: 1 }])),
    http.get(`${API}/analysis`, () => HttpResponse.json([])),
    http.post(`${API}/analysis`, () => HttpResponse.json({ error: { message: 'boom', code: 'X' } }, { status: 500 })),
  );
  renderPage();
  await waitFor(() => expect(screen.getByRole('option', { name: /Backend Engineer/ })).toBeInTheDocument());
  await userEvent.selectOptions(screen.getByLabelText(/application/i), 'a1');
  await userEvent.selectOptions(screen.getByLabelText(/résumé|resume/i), 'd1');
  await userEvent.click(screen.getByRole('button', { name: /run analysis/i }));
  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
});

test('AI toggle is disabled when the server has no key', async () => {
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([])),
    http.get(`${API}/documents`, () => HttpResponse.json([])),
    http.get(`${API}/analysis`, () => HttpResponse.json([])),
    http.get(`${API}/analysis/config`, () => HttpResponse.json({ aiAvailable: false })),
  );
  renderPage();
  await waitFor(() => expect(screen.getByLabelText(/use ai/i)).toBeDisabled());
});

test('with AI available, checking the toggle posts useAi:true and shows the AI badge', async () => {
  let postedUseAi = null;
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([{ id: 'a1', position: 'Backend Engineer' }])),
    http.get(`${API}/applications/a1`, () => HttpResponse.json({ id: 'a1', position: 'Backend Engineer', jobDescription: 'Rust' })),
    http.get(`${API}/documents`, () => HttpResponse.json([{ id: 'd1', name: 'Backend Resume', type: 'Resume', originalFilename: 'r.pdf', mimeType: 'application/pdf', sizeBytes: 1 }])),
    http.get(`${API}/analysis`, () => HttpResponse.json([])),
    http.get(`${API}/analysis/config`, () => HttpResponse.json({ aiAvailable: true })),
    http.post(`${API}/analysis`, async ({ request }) => {
      postedUseAi = (await request.json()).useAi;
      return HttpResponse.json({ id: 'an1', atsScore: 82, matchScore: 70,
        report: { ...REPORT, meta: { ...REPORT.meta, aiUsed: true, aiModel: 'test/model:free' } }, createdAt: new Date().toISOString() }, { status: 201 });
    }),
  );
  renderPage();
  await waitFor(() => expect(screen.getByLabelText(/use ai/i)).toBeEnabled());
  await userEvent.selectOptions(screen.getByLabelText(/application/i), 'a1');
  await userEvent.selectOptions(screen.getByLabelText(/résumé|resume/i), 'd1');
  await userEvent.click(screen.getByLabelText(/use ai/i));
  expect(screen.getByText(/sends your résumé text/i)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /run analysis/i }));
  await waitFor(() => expect(postedUseAi).toBe(true));
  await waitFor(() => expect(screen.getByText(/AI-assisted match/i)).toBeInTheDocument());
});

test('fires ai_analysis_run on submit with the ai flag', async () => {
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([{ id: 'a1', position: 'Backend Engineer' }])),
    http.get(`${API}/applications/a1`, () => HttpResponse.json({ id: 'a1', position: 'Backend Engineer', jobDescription: 'Node.js' })),
    http.get(`${API}/documents`, () => HttpResponse.json([{ id: 'd1', name: 'Backend Resume', type: 'Resume', originalFilename: 'r.pdf', mimeType: 'application/pdf', sizeBytes: 1 }])),
    http.get(`${API}/analysis`, () => HttpResponse.json([])),
    http.post(`${API}/analysis`, () => HttpResponse.json({ id: 'an1', atsScore: 82, matchScore: 67, report: REPORT, createdAt: new Date().toISOString() }, { status: 201 })),
  );
  renderPage();
  await waitFor(() => expect(screen.getByRole('option', { name: /Backend Engineer/ })).toBeInTheDocument());
  await userEvent.selectOptions(screen.getByLabelText(/application/i), 'a1');
  await userEvent.selectOptions(screen.getByLabelText(/résumé|resume/i), 'd1');
  await userEvent.click(screen.getByRole('button', { name: /run analysis/i }));

  expect(trackEvent).toHaveBeenCalledWith('ai_analysis_run', { ai: false });
});

test('does not fire ai_analysis_run when validation blocks the submit', async () => {
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([])),
    http.get(`${API}/documents`, () => HttpResponse.json([])),
    http.get(`${API}/analysis`, () => HttpResponse.json([])),
  );
  renderPage();
  await userEvent.click(screen.getByRole('button', { name: /run analysis/i }));

  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/pick an application/i));
  expect(trackEvent).not.toHaveBeenCalled();
});
