import { http, HttpResponse } from 'msw';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { server, API } from '../test/server';
import Analysis from './Analysis';
import Interviews from './Interviews';
import TailorResume from './TailorResume';
import CoverLetter from './CoverLetter';

// Four pages use listApplications() only to fill a "pick an application"
// <select>. If a paginated subset ever lands in the ['applications'] key they
// share with the Applications page, these dropdowns silently show page 1 — the
// user cannot find an application that exists, assumes it is missing, and
// creates a duplicate. That presents as missing data, not as a pagination bug,
// which is why it needs its own guard rather than review attention.
const APPS = Array.from({ length: 30 }, (_, i) => ({
  id: `a${i + 1}`,
  position: `Role ${i + 1}`,
  status: 'Applied',
  company: null,
}));

vi.mock('../observability/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('../api/documents', async (importActual) => ({
  ...(await importActual()),
  createDocument: vi.fn(),
  linkDocument: vi.fn(),
}));
vi.mock('../api/authoredDocuments', () => ({ createAuthoredDocument: vi.fn() }));
vi.mock('../lib/openDocumentInEditor', () => ({ fetchEditorContent: vi.fn() }));

beforeEach(() => {
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json(APPS)),
    http.get(`${API}/documents`, () => HttpResponse.json([])),
    http.get(`${API}/interviews`, () => HttpResponse.json([])),
    http.get(`${API}/companies`, () => HttpResponse.json([])),
    http.get(`${API}/analysis`, () => HttpResponse.json([])),
    http.get(`${API}/analysis/config`, () => HttpResponse.json({ aiAvailable: false })),
  );
});

function renderPage(ui) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const PAGES = [
  ['Analysis', <Analysis key="analysis" />],
  ['Interviews', <Interviews key="interviews" />],
  ['TailorResume', <TailorResume key="tailor" />],
  ['CoverLetter', <CoverLetter key="cover" />],
];

test.each(PAGES)('%s lists every application in its dropdown, not just one page', async (_name, ui) => {
  renderPage(ui);
  // The first row proves the query resolved; the 30th proves it was not sliced
  // to a page. 30 > the default pageSize of 25 deliberately.
  expect(await screen.findByRole('option', { name: 'Role 1' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Role 30' })).toBeInTheDocument();
  expect(screen.getAllByRole('option', { name: /^Role \d+$/ })).toHaveLength(30);
});
