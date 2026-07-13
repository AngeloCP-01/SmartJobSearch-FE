import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server, API } from '../test/server';
import TailorResume from './TailorResume';
import { createDocument, linkDocument } from '../api/documents';
import { fetchEditorContent } from '../lib/openDocumentInEditor';
import { createAuthoredDocument } from '../api/authoredDocuments';

// Keep real listDocuments (drives the dropdown via MSW); mock only the writes.
vi.mock('../api/documents', async (importActual) => ({
  ...(await importActual()),
  createDocument: vi.fn(),
  linkDocument: vi.fn(),
}));

const navigateMock = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => ({ ...(await importOriginal()), useNavigate: () => navigateMock }));
vi.mock('../lib/openDocumentInEditor', () => ({ fetchEditorContent: vi.fn() }));
vi.mock('../api/authoredDocuments', () => ({ createAuthoredDocument: vi.fn() }));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><TailorResume /></QueryClientProvider>);
}

beforeEach(() => {
  createDocument.mockReset();
  linkDocument.mockReset();
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([{ id: 'a1', position: 'Backend Engineer', status: 'Applied' }])),
    http.get(`${API}/documents`, () => HttpResponse.json([{ id: 'd1', name: 'My Resume', type: 'Resume' }])),
    http.get(`${API}/analysis/config`, () => HttpResponse.json({ aiAvailable: true })),
    http.get(`${API}/applications/a1`, () => HttpResponse.json({ id: 'a1', position: 'Backend Engineer', jobDescription: 'Kafka role' })),
  );
});

async function pickBoth(user) {
  await screen.findByRole('option', { name: 'Backend Engineer' });
  await screen.findByRole('option', { name: 'My Resume' });
  await user.selectOptions(screen.getByLabelText('Application'), 'a1');
  await user.selectOptions(screen.getByLabelText('Résumé'), 'd1');
}

test('generates and renders grounded tailoring suggestions', async () => {
  server.use(http.post(`${API}/analysis/tailor`, () => HttpResponse.json({
    suggestions: [
      { kind: 'add', text: 'Add your Kafka pipeline work.', why: 'The JD requires Kafka.', groundedIn: 'My Resume', severity: 'high' },
      { kind: 'emphasize', text: 'Move PostgreSQL up.', why: 'Listed as required.', groundedIn: 'this résumé', severity: 'medium' },
    ],
    meta: { position: 'Backend Engineer', companyName: 'Acme', documentName: 'My Resume', model: 'test/model:free', evidenceCount: 1 },
  }, { status: 201 })));

  const user = userEvent.setup();
  renderPage();
  await pickBoth(user);
  await user.click(screen.getByRole('button', { name: /tailor/i }));

  expect(await screen.findByText('Add your Kafka pipeline work.')).toBeInTheDocument();
  expect(screen.getByText('Move PostgreSQL up.')).toBeInTheDocument();
  expect(screen.getByText(/grounded in My Resume/i)).toBeInTheDocument();
});

test('Generate is disabled when AI is unavailable', async () => {
  server.use(http.get(`${API}/analysis/config`, () => HttpResponse.json({ aiAvailable: false })));
  renderPage();
  await screen.findByRole('option', { name: 'Backend Engineer' });
  await waitFor(() => expect(screen.getByRole('button', { name: /tailor/i })).toBeDisabled());
});

test('warns when the chosen application has no job description', async () => {
  server.use(http.get(`${API}/applications/a1`, () => HttpResponse.json({ id: 'a1', position: 'Backend Engineer', jobDescription: '' })));
  const user = userEvent.setup();
  renderPage();
  await screen.findByRole('option', { name: 'Backend Engineer' });
  await user.selectOptions(screen.getByLabelText('Application'), 'a1');
  expect(await screen.findByText(/no job description/i)).toBeInTheDocument();
});

test('Save to Documents writes a notes doc linked to the application', async () => {
  createDocument.mockResolvedValue({ id: 'newdoc' });
  linkDocument.mockResolvedValue({});
  server.use(http.post(`${API}/analysis/tailor`, () => HttpResponse.json({
    suggestions: [{ kind: 'emphasize', text: 'Move PostgreSQL up.', why: 'Required.', groundedIn: 'this résumé', severity: 'medium' }],
    meta: { position: 'Backend Engineer', companyName: 'Acme', documentName: 'My Resume', model: 'm', evidenceCount: 0 },
  }, { status: 201 })));

  const user = userEvent.setup();
  renderPage();
  await pickBoth(user);
  await user.click(screen.getByRole('button', { name: /tailor/i }));
  await screen.findByText('Move PostgreSQL up.');
  await user.click(screen.getByRole('button', { name: /save to documents/i }));

  await waitFor(() => expect(createDocument).toHaveBeenCalled());
  expect(linkDocument).toHaveBeenCalledWith('a1', 'newdoc');
});

test('Draft in Editor opens the résumé with the suggestions in nav state', async () => {
  navigateMock.mockReset();
  fetchEditorContent.mockResolvedValue({ ok: true, content: { type: 'doc', content: [] } });
  createAuthoredDocument.mockResolvedValue({ id: 'authored-1' });
  server.use(http.post(`${API}/analysis/tailor`, () => HttpResponse.json({
    suggestions: [{ kind: 'rephrase', text: 'Use "architected".', why: 'Stronger.', groundedIn: 'this résumé', anchor: 'built REST APIs', severity: 'low' }],
    meta: { position: 'Backend Engineer', companyName: 'Acme', documentName: 'My Resume', model: 'm', evidenceCount: 0 },
  }, { status: 201 })));

  const user = userEvent.setup();
  renderPage();
  await pickBoth(user);
  await user.click(screen.getByRole('button', { name: /tailor/i }));
  await screen.findByText('Use "architected".');

  await user.click(screen.getByRole('button', { name: /draft in editor/i }));

  await waitFor(() => expect(createAuthoredDocument).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'Resume', content: { type: 'doc', content: [] } }),
  ));
  expect(navigateMock).toHaveBeenCalledWith(
    '/editor/authored-1',
    expect.objectContaining({ state: expect.objectContaining({ tailoring: expect.objectContaining({ suggestions: expect.any(Array) }) }) }),
  );
});
