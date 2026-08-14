import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { server, API, API_V2 } from '../test/server';
import Analysis from './Analysis';
import { trackEvent } from '../observability/analytics';

vi.mock('../observability/analytics', () => ({ trackEvent: vi.fn() }));

beforeEach(() => { trackEvent.mockClear(); });

const historyPage = (items) => ({
  items, page: 1, pageSize: 10, total: items.length, totalPages: items.length ? 1 : 0,
});

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
    http.get(`${API_V2}/analysis`, () => HttpResponse.json(historyPage([]))),
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
    http.get(`${API_V2}/analysis`, () => HttpResponse.json(historyPage([
      { id: 'an1', atsScore: 82, matchScore: 67, documentName: 'Backend Resume', position: 'Backend Engineer', createdAt: new Date().toISOString() },
    ]))),
  );
  renderPage();
  await waitFor(() => expect(screen.getByText('Backend Resume')).toBeInTheDocument());
});

test('shows the no-job-description note when the selected application has no JD', async () => {
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([{ id: 'a1', position: 'Backend Engineer' }])),
    http.get(`${API}/applications/a1`, () => HttpResponse.json({ id: 'a1', position: 'Backend Engineer', jobDescription: null })),
    http.get(`${API}/documents`, () => HttpResponse.json([])),
    http.get(`${API_V2}/analysis`, () => HttpResponse.json(historyPage([]))),
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
    http.get(`${API_V2}/analysis`, () => HttpResponse.json(historyPage([]))),
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
    http.get(`${API_V2}/analysis`, () => HttpResponse.json(historyPage([]))),
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
    http.get(`${API_V2}/analysis`, () => HttpResponse.json(historyPage([]))),
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
    http.get(`${API_V2}/analysis`, () => HttpResponse.json(historyPage([]))),
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
    http.get(`${API_V2}/analysis`, () => HttpResponse.json(historyPage([]))),
  );
  renderPage();
  await userEvent.click(screen.getByRole('button', { name: /run analysis/i }));

  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/pick an application/i));
  expect(trackEvent).not.toHaveBeenCalled();
});

test('still fires ai_analysis_run when the run fails, since failure volume is a useful signal', async () => {
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([{ id: 'a1', position: 'Backend Engineer' }])),
    http.get(`${API}/applications/a1`, () => HttpResponse.json({ id: 'a1', position: 'Backend Engineer', jobDescription: 'Node.js' })),
    http.get(`${API}/documents`, () => HttpResponse.json([{ id: 'd1', name: 'Backend Resume', type: 'Resume', originalFilename: 'r.pdf', mimeType: 'application/pdf', sizeBytes: 1 }])),
    http.get(`${API_V2}/analysis`, () => HttpResponse.json(historyPage([]))),
    http.post(`${API}/analysis`, () => HttpResponse.json({ error: { message: 'boom', code: 'X' } }, { status: 500 })),
  );
  renderPage();
  await waitFor(() => expect(screen.getByRole('option', { name: /Backend Engineer/ })).toBeInTheDocument());
  await userEvent.selectOptions(screen.getByLabelText(/application/i), 'a1');
  await userEvent.selectOptions(screen.getByLabelText(/résumé|resume/i), 'd1');
  await userEvent.click(screen.getByRole('button', { name: /run analysis/i }));

  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  expect(trackEvent).toHaveBeenCalledWith('ai_analysis_run', { ai: false });
});

test('past analyses ask for page 1 at size 10, newest first', async () => {
  let seen = null;
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([])),
    http.get(`${API}/documents`, () => HttpResponse.json([])),
    http.get(`${API_V2}/analysis`, ({ request }) => {
      seen = Object.fromEntries(new URL(request.url).searchParams);
      return HttpResponse.json({
        items: [{ id: 'an1', documentName: 'Backend Resume', position: 'Backend Eng', atsScore: 82, matchScore: 67 }],
        page: 1, pageSize: 10, total: 34, totalPages: 4,
      });
    }),
  );
  renderPage();
  await waitFor(() => expect(screen.getByText('1–10 of 34')).toBeInTheDocument());
  expect(seen).toEqual({ page: '1', pageSize: '10', sort: 'createdAt', dir: 'desc' });
});

test('deleting the last row on the last page steps back a page', async () => {
  // v2 answers a past-the-end page with items: [] and a truthful total, so the
  // client recovers from totalPages rather than showing an empty list.
  let deleted = false;
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([])),
    http.get(`${API}/documents`, () => HttpResponse.json([])),
    http.get(`${API_V2}/analysis`, ({ request }) => {
      const p = Number(new URL(request.url).searchParams.get('page'));
      const total = deleted ? 10 : 11;
      const totalPages = Math.ceil(total / 10);
      const items = p > totalPages
        ? []
        : [{ id: `an-p${p}`, documentName: `Doc p${p}`, position: 'Eng', atsScore: 80, matchScore: 60 }];
      return HttpResponse.json({ items, page: p, pageSize: 10, total, totalPages });
    }),
    http.delete(`${API}/analysis/an-p2`, () => { deleted = true; return new HttpResponse(null, { status: 204 }); }),
  );
  renderPage();
  await screen.findByText('Doc p1');
  await userEvent.click(screen.getByRole('button', { name: 'Page 2' }));
  await screen.findByText('Doc p2');
  await userEvent.click(screen.getByRole('button', { name: /delete analysis of doc p2/i }));
  await waitFor(() => expect(screen.getByText('Doc p1')).toBeInTheDocument());
  expect(screen.getByText('1–10 of 10')).toBeInTheDocument();
});
