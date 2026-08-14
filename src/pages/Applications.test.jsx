import { http, HttpResponse, delay } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server, API, API_V2 } from '../test/server';
import api from '../api/client';
import Applications, { moveMutationOptions, patchAppStatus } from './Applications';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><Applications /></QueryClientProvider>);
}

// Shapes a v2 offset envelope from a plain row array, for List-view tests.
const page = (items) => ({ items, page: 1, pageSize: 25, total: items.length, totalPages: items.length ? 1 : 0 });

// The view choice is persisted to localStorage; reset it so each test starts on
// the default Kanban board. The company filter now reads the full companies
// list, so give every test a default (empty) handler for it.
beforeEach(() => {
  localStorage.clear();
  server.use(http.get(`${API}/companies`, () => HttpResponse.json([])));
});

test('renders a column per status and places cards by status', async () => {
  server.use(http.get(`${API}/applications`, () => HttpResponse.json([
    { id: 'a1', position: 'Backend Eng', status: 'Applied' },
  ])));
  renderPage();
  await waitFor(() => expect(screen.getByText('Backend Eng')).toBeInTheDocument());
  expect(screen.getByRole('heading', { name: 'Applied' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Offer' })).toBeInTheDocument();
});

test('moving a card calls PATCH /:id/status with the target column', async () => {
  let patched = null;
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([{ id: 'a1', position: 'Backend Eng', status: 'Applied' }])),
    http.patch(`${API}/applications/a1/status`, async ({ request }) => {
      patched = await request.json();
      return HttpResponse.json({ id: 'a1', position: 'Backend Eng', status: patched.status });
    }),
  );
  renderPage();
  await waitFor(() => expect(screen.getByText('Backend Eng')).toBeInTheDocument());
  // jsdom can't do real pointer DnD, so test the pure drop-mapping helper:
  const { applyDrop } = await import('./Applications');
  await applyDrop({ activeId: 'a1', overId: 'Offer' }, (id, status) =>
    api.patch(`/applications/${id}/status`, { status }));
  await waitFor(() => expect(patched).toEqual({ status: 'Offer' }));
});

test('cards show the company name and salary chip', async () => {
  server.use(http.get(`${API}/applications`, () => HttpResponse.json([
    { id: 'a1', position: 'Backend Eng', status: 'Applied', company: { id: 'c1', name: 'Acme' }, salaryMin: 90000, salaryMax: 110000 },
  ])));
  renderPage();
  await waitFor(() => expect(screen.getByText('Backend Eng')).toBeInTheDocument());
  expect(screen.getByText('Acme', { selector: 'p' })).toBeInTheDocument(); // card, not the filter <option>
  expect(screen.getByText(/90k/)).toBeInTheDocument();
});

test('cards show a work-mode chip', async () => {
  server.use(http.get(`${API}/applications`, () => HttpResponse.json([
    { id: 'a1', position: 'Backend Eng', status: 'Applied', workMode: 'Remote' },
  ])));
  renderPage();
  await waitFor(() => expect(screen.getByText('Backend Eng')).toBeInTheDocument());
  expect(screen.getByText('Remote')).toBeInTheDocument();
});

test('cards show the applied date', async () => {
  server.use(http.get(`${API}/applications`, () => HttpResponse.json([
    { id: 'a1', position: 'Backend Eng', status: 'Applied', applicationDate: '2026-06-23T00:00:00.000Z' },
  ])));
  renderPage();
  await waitFor(() => expect(screen.getByText('Backend Eng')).toBeInTheDocument());
  expect(screen.getByText(/Applied 2026-06-23/)).toBeInTheDocument();
});

test('clicking the card body opens the drawer pre-filled', async () => {
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([{ id: 'a1', position: 'Backend Eng', status: 'Applied', company: null }])),
    http.get(`${API}/applications/a1`, () => HttpResponse.json({ id: 'a1', position: 'Backend Eng', status: 'Applied', company: null, contacts: [] })),
    http.get(`${API}/companies`, () => HttpResponse.json([])),
    http.get(`${API}/interviews`, () => HttpResponse.json([])),
    http.get(`${API}/contacts`, () => HttpResponse.json([])),
  );
  renderPage();
  await userEvent.click(await screen.findByText('Backend Eng'));
  await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
  expect(screen.getByLabelText(/position/i)).toHaveValue('Backend Eng');
});

test('clicking a card open button opens the drawer pre-filled', async () => {
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([{ id: 'a1', position: 'Backend Eng', status: 'Applied', company: null }])),
    http.get(`${API}/applications/a1`, () => HttpResponse.json({ id: 'a1', position: 'Backend Eng', status: 'Applied', company: null, contacts: [] })),
    http.get(`${API}/companies`, () => HttpResponse.json([])),
    http.get(`${API}/interviews`, () => HttpResponse.json([])),
    http.get(`${API}/contacts`, () => HttpResponse.json([])),
  );
  renderPage();
  await waitFor(() => expect(screen.getByText('Backend Eng')).toBeInTheDocument());
  await userEvent.click(screen.getByRole('button', { name: /open backend eng/i }));
  await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
  expect(screen.getByLabelText(/position/i)).toHaveValue('Backend Eng');
});

test('search filters the board by position', async () => {
  server.use(http.get(`${API}/applications`, () => HttpResponse.json([
    { id: 'a1', position: 'Backend Eng', status: 'Applied' },
    { id: 'a2', position: 'Frontend Eng', status: 'Applied' },
  ])));
  renderPage();
  await waitFor(() => expect(screen.getByText('Backend Eng')).toBeInTheDocument());
  expect(screen.getByText('Frontend Eng')).toBeInTheDocument();
  await userEvent.type(screen.getByPlaceholderText(/search applications/i), 'front');
  await waitFor(() => expect(screen.queryByText('Backend Eng')).not.toBeInTheDocument());
  expect(screen.getByText('Frontend Eng')).toBeInTheDocument();
});

test('List view shows applications in a table with a sortable header and status dropdown', async () => {
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([
      { id: 'a1', position: 'Backend Eng', status: 'Applied', company: { id: 'c1', name: 'Acme' }, salaryMin: 90000, salaryMax: 110000, applicationDate: '2026-06-23T00:00:00.000Z' },
    ])),
    http.get(`${API_V2}/applications`, () => HttpResponse.json(page([
      { id: 'a1', position: 'Backend Eng', status: 'Applied', company: { id: 'c1', name: 'Acme' }, salaryMin: 90000, salaryMax: 110000, applicationDate: '2026-06-23T00:00:00.000Z' },
    ]))),
  );
  renderPage();
  await waitFor(() => expect(screen.getByText('Backend Eng')).toBeInTheDocument());
  await userEvent.click(screen.getByRole('button', { name: /^list$/i }));
  expect(screen.getByRole('button', { name: /sort by position/i })).toBeInTheDocument();
  expect(screen.getByText('Acme', { selector: 'td' })).toBeInTheDocument(); // cell, not the filter <option>
  expect(screen.getByText(/90k/)).toBeInTheDocument();
  expect(screen.getByLabelText('Status for Backend Eng')).toHaveValue('Applied');
});

test('changing status from the List view PATCHes /:id/status', async () => {
  let patched = null;
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([{ id: 'a1', position: 'Backend Eng', status: 'Applied' }])),
    http.get(`${API_V2}/applications`, () => HttpResponse.json(page([{ id: 'a1', position: 'Backend Eng', status: 'Applied' }]))),
    http.patch(`${API}/applications/a1/status`, async ({ request }) => {
      patched = await request.json();
      return HttpResponse.json({ id: 'a1', position: 'Backend Eng', status: patched.status });
    }),
  );
  renderPage();
  await waitFor(() => expect(screen.getByText('Backend Eng')).toBeInTheDocument());
  await userEvent.click(screen.getByRole('button', { name: /^list$/i }));
  await userEvent.selectOptions(screen.getByLabelText('Status for Backend Eng'), 'Offer');
  await waitFor(() => expect(patched).toEqual({ status: 'Offer' }));
});

test('remembers the selected view across remounts (localStorage)', async () => {
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([{ id: 'a1', position: 'Backend Eng', status: 'Applied' }])),
    http.get(`${API_V2}/applications`, () => HttpResponse.json(page([{ id: 'a1', position: 'Backend Eng', status: 'Applied' }]))),
  );
  const { unmount } = renderPage();
  await waitFor(() => expect(screen.getByText('Backend Eng')).toBeInTheDocument());
  await userEvent.click(screen.getByRole('button', { name: /^list$/i }));
  expect(localStorage.getItem('applicationsView')).toBe('list');
  unmount();
  renderPage();
  await waitFor(() => expect(screen.getByLabelText('Status for Backend Eng')).toBeInTheDocument());
});

test('filters applications by status', async () => {
  server.use(http.get(`${API}/applications`, () => HttpResponse.json([
    { id: 'a1', position: 'Backend Eng', status: 'Applied', company: null },
    { id: 'a2', position: 'Frontend Eng', status: 'Offer', company: null },
  ])));
  renderPage();
  await waitFor(() => expect(screen.getByText('Backend Eng')).toBeInTheDocument());
  expect(screen.getByText('Frontend Eng')).toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText(/filter by status/i), 'Offer');
  await waitFor(() => expect(screen.queryByText('Backend Eng')).not.toBeInTheDocument());
  expect(screen.getByText('Frontend Eng')).toBeInTheDocument();
});

test('the company filter lists every company, not just one page', async () => {
  // This filter is a fifth consumer of the bare ['companies'] key, alongside
  // ApplicationDrawer.jsx:90 and ContactDrawer.jsx:42 — it reads listCompanies()
  // (v1, all rows) via the same shared cache. The Companies *page* keys
  // separately (['companies','page',params]), so today there is no defect;
  // this guards that a future change doesn't silently point this dropdown at a
  // paginated call. 30 exceeds the default pageSize of 25 so truncation would
  // be visible.
  const companies = Array.from({ length: 30 }, (_, i) => ({ id: `c${i + 1}`, name: `Company ${i + 1}` }));
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([])),
    http.get(`${API}/companies`, () => HttpResponse.json(companies)),
  );
  renderPage();
  expect(await screen.findByRole('option', { name: 'Company 1' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Company 30' })).toBeInTheDocument();
  expect(screen.getAllByRole('option', { name: /^Company \d+$/ })).toHaveLength(30);
});

test('filters applications by company', async () => {
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([
      { id: 'a1', position: 'Backend Eng', status: 'Applied', company: { id: 'c1', name: 'Acme' } },
      { id: 'a2', position: 'Frontend Eng', status: 'Applied', company: { id: 'c2', name: 'Globex' } },
    ])),
    http.get(`${API}/companies`, () => HttpResponse.json([
      { id: 'c1', name: 'Acme' }, { id: 'c2', name: 'Globex' },
    ])),
  );
  renderPage();
  await waitFor(() => expect(screen.getByText('Backend Eng')).toBeInTheDocument());
  await userEvent.selectOptions(screen.getByLabelText(/filter by company/i), 'c1');
  await waitFor(() => expect(screen.queryByText('Frontend Eng')).not.toBeInTheDocument());
  expect(screen.getByText('Backend Eng')).toBeInTheDocument();
});

test('Clear resets the active filters', async () => {
  server.use(http.get(`${API}/applications`, () => HttpResponse.json([
    { id: 'a1', position: 'Backend Eng', status: 'Applied', company: null },
    { id: 'a2', position: 'Frontend Eng', status: 'Offer', company: null },
  ])));
  renderPage();
  await waitFor(() => expect(screen.getByText('Backend Eng')).toBeInTheDocument());
  await userEvent.selectOptions(screen.getByLabelText(/filter by status/i), 'Offer');
  await waitFor(() => expect(screen.queryByText('Backend Eng')).not.toBeInTheDocument());
  await userEvent.click(screen.getByRole('button', { name: /^clear$/i }));
  await waitFor(() => expect(screen.getByText('Backend Eng')).toBeInTheDocument());
  expect(screen.getByText('Frontend Eng')).toBeInTheDocument();
});

test('has no redundant quick-add "Add application" button', async () => {
  server.use(http.get(`${API}/applications`, () => HttpResponse.json([])));
  renderPage();
  await waitFor(() => expect(screen.getByRole('button', { name: /new application/i })).toBeInTheDocument());
  expect(screen.queryByRole('button', { name: /add application/i })).not.toBeInTheDocument();
});

test('New application button opens the drawer in create mode', async () => {
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([])),
    http.get(`${API}/companies`, () => HttpResponse.json([])),
  );
  renderPage();
  await userEvent.click(screen.getByRole('button', { name: /new application/i }));
  await waitFor(() => expect(screen.getByRole('dialog', { name: /new application/i })).toBeInTheDocument());
});

test('patchAppStatus updates both cache shapes and leaves anything else alone', () => {
  const rows = [{ id: 'a1', status: 'Applied' }, { id: 'a2', status: 'Draft' }];
  expect(patchAppStatus(rows, 'a1', 'Offer')[0].status).toBe('Offer');
  expect(patchAppStatus(rows, 'a1', 'Offer')[1].status).toBe('Draft');

  const envelope = { items: rows, page: 1, pageSize: 25, total: 2, totalPages: 1 };
  const patched = patchAppStatus(envelope, 'a2', 'Rejected');
  expect(patched.items[1].status).toBe('Rejected');
  expect(patched.total).toBe(2); // envelope metadata survives

  expect(patchAppStatus(undefined, 'a1', 'Offer')).toBeUndefined(); // unfetched query
});

test('move optimistically updates every applications cache and rolls them all back', async () => {
  // The List view reads ['applications','page',…] while the dropdowns read
  // ['applications']; an optimistic move has to reach whichever is mounted.
  const qc = new QueryClient();
  const params = { page: 1, pageSize: 25 };
  qc.setQueryData(['applications'], [{ id: 'a1', position: 'X', status: 'Applied' }]);
  qc.setQueryData(['applications', 'page', params], {
    items: [{ id: 'a1', position: 'X', status: 'Applied' }], page: 1, pageSize: 25, total: 1, totalPages: 1,
  });
  const opts = moveMutationOptions(qc);

  const ctx = await opts.onMutate({ id: 'a1', status: 'Offer' });
  expect(qc.getQueryData(['applications'])[0].status).toBe('Offer');
  expect(qc.getQueryData(['applications', 'page', params]).items[0].status).toBe('Offer');

  opts.onError(new Error('fail'), { id: 'a1', status: 'Offer' }, ctx);
  expect(qc.getQueryData(['applications'])[0].status).toBe('Applied');
  expect(qc.getQueryData(['applications', 'page', params]).items[0].status).toBe('Applied');
});

test('the board makes no v2 request — it needs every row', async () => {
  let v2Calls = 0;
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([{ id: 'a1', position: 'Backend Eng', status: 'Applied' }])),
    http.get(`${API_V2}/applications`, () => { v2Calls += 1; return HttpResponse.json(page([])); }),
  );
  renderPage();
  await waitFor(() => expect(screen.getByText('Backend Eng')).toBeInTheDocument());
  expect(v2Calls).toBe(0);
});

test('the List view never writes a page into the all-rows ["applications"] cache', async () => {
  // The guard that matters: four dropdown pages read that key.
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([{ id: 'a1', position: 'Backend Eng', status: 'Applied' }])),
    http.get(`${API_V2}/applications`, () => HttpResponse.json(page([{ id: 'a1', position: 'Backend Eng', status: 'Applied' }]))),
  );
  render(<QueryClientProvider client={qc}><Applications /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByText('Backend Eng')).toBeInTheDocument());
  await userEvent.click(screen.getByRole('button', { name: /^list$/i }));
  await waitFor(() => expect(screen.getByLabelText('Status for Backend Eng')).toBeInTheDocument());
  const allRows = qc.getQueryData(['applications']);
  expect(Array.isArray(allRows)).toBe(true); // still the v1 array, not an envelope
});

test('the List view asks for page 1 at the default size and shows the count', async () => {
  let seen = null;
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([])),
    http.get(`${API_V2}/applications`, ({ request }) => {
      seen = Object.fromEntries(new URL(request.url).searchParams);
      return HttpResponse.json({
        items: [{ id: 'a1', position: 'Backend Eng', status: 'Applied' }],
        page: 1, pageSize: 25, total: 137, totalPages: 6,
      });
    }),
  );
  localStorage.setItem('applicationsView', 'list');
  renderPage();
  await waitFor(() => expect(screen.getByText('1–25 of 137')).toBeInTheDocument());
  expect(seen).toMatchObject({ page: '1', pageSize: '25', sort: 'applicationDate', dir: 'desc' });
});

test('clicking Next asks the server for page 2', async () => {
  const seen = [];
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([])),
    http.get(`${API_V2}/applications`, ({ request }) => {
      const p = Number(new URL(request.url).searchParams.get('page'));
      seen.push(p);
      return HttpResponse.json({ items: [{ id: `a${p}`, position: `Row ${p}`, status: 'Applied' }], page: p, pageSize: 25, total: 137, totalPages: 6 });
    }),
  );
  localStorage.setItem('applicationsView', 'list');
  renderPage();
  await screen.findByText('Row 1');
  await userEvent.click(screen.getByRole('button', { name: /next page/i }));
  await waitFor(() => expect(screen.getByText('Row 2')).toBeInTheDocument());
  expect(seen).toContain(2);
});

test('changing the page size sends an allowlisted value and returns to page 1', async () => {
  const seen = [];
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([])),
    http.get(`${API_V2}/applications`, ({ request }) => {
      const q = new URL(request.url).searchParams;
      seen.push({ page: q.get('page'), pageSize: q.get('pageSize') });
      return HttpResponse.json({ items: [{ id: 'a1', position: 'Backend Eng', status: 'Applied' }], page: Number(q.get('page')), pageSize: Number(q.get('pageSize')), total: 137, totalPages: 6 });
    }),
  );
  localStorage.setItem('applicationsView', 'list');
  renderPage();
  await screen.findByText('Backend Eng');
  await userEvent.click(screen.getByRole('button', { name: /next page/i }));
  await waitFor(() => expect(seen.at(-1).page).toBe('2'));
  await userEvent.selectOptions(screen.getByLabelText(/rows per page/i), '50');
  // A bigger page renumbers everything, so page 2 is meaningless — go back to 1.
  // The reset happens in the change handler, not an effect after the fact, so
  // no request for the stale page-2-with-size-50 combination should ever fire.
  await waitFor(() => expect(seen.at(-1)).toEqual({ page: '1', pageSize: '50' }));
  expect(seen).not.toContainEqual({ page: '2', pageSize: '50' });
});

test('search is debounced into one request and filtered by the server', async () => {
  const terms = [];
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([])),
    http.get(`${API_V2}/applications`, ({ request }) => {
      terms.push(new URL(request.url).searchParams.get('search'));
      return HttpResponse.json(page([{ id: 'a1', position: 'Backend Eng', status: 'Applied' }]));
    }),
  );
  localStorage.setItem('applicationsView', 'list');
  renderPage();
  await screen.findByText('Backend Eng');
  await userEvent.type(screen.getByPlaceholderText(/search applications/i), 'kafka');
  await waitFor(() => expect(terms).toContain('kafka'));
  // Five keystrokes, one request: no intermediate 'k','ka','kaf','kafk'.
  expect(terms.filter(Boolean)).toEqual(['kafka']);
});

test('a status filter resets the pager back to page 1', async () => {
  const seen = [];
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([])),
    http.get(`${API_V2}/applications`, ({ request }) => {
      const q = new URL(request.url).searchParams;
      seen.push({ page: q.get('page'), status: q.get('status') });
      return HttpResponse.json({ items: [{ id: 'a1', position: 'Backend Eng', status: 'Applied' }], page: Number(q.get('page')), pageSize: 25, total: 137, totalPages: 6 });
    }),
  );
  localStorage.setItem('applicationsView', 'list');
  renderPage();
  await screen.findByText('Backend Eng');
  await userEvent.click(screen.getByRole('button', { name: /next page/i }));
  await waitFor(() => expect(seen.at(-1).page).toBe('2'));
  await userEvent.selectOptions(screen.getByLabelText(/filter by status/i), 'Offer');
  // Otherwise a filter that shrinks the set strands the user on an empty page 7.
  await waitFor(() => expect(seen.at(-1)).toEqual({ page: '1', status: 'Offer' }));
  // The reset happens in the change handler, not an effect after the fact, so
  // a request for the stale {page: 2, status: 'Offer'} combination should
  // never have gone out.
  expect(seen).not.toContainEqual({ page: '2', status: 'Offer' });
});

test('Salary is shown but is not a sort control', async () => {
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([])),
    http.get(`${API_V2}/applications`, () => HttpResponse.json(page([
      { id: 'a1', position: 'Backend Eng', status: 'Applied', salaryMin: 90000, salaryMax: 110000 },
    ]))),
  );
  localStorage.setItem('applicationsView', 'list');
  renderPage();
  await screen.findByText(/90k/);
  // v2 does not accept sort=salary (400), and sorting one page would report the
  // page maximum as the overall maximum.
  expect(screen.getByRole('columnheader', { name: /salary/i })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /sort by salary/i })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /sort by position/i })).toBeInTheDocument();
});

test('sorting by a column asks the server, not the client', async () => {
  let seen = null;
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([])),
    http.get(`${API_V2}/applications`, ({ request }) => {
      const q = new URL(request.url).searchParams;
      seen = { sort: q.get('sort'), dir: q.get('dir') };
      return HttpResponse.json(page([{ id: 'a1', position: 'Backend Eng', status: 'Applied' }]));
    }),
  );
  localStorage.setItem('applicationsView', 'list');
  renderPage();
  await screen.findByText('Backend Eng');
  await userEvent.click(screen.getByRole('button', { name: /sort by position/i }));
  await waitFor(() => expect(seen).toEqual({ sort: 'position', dir: 'asc' }));
});

test('clearing a filter never flashes "No applications yet" over real data via a stale placeholder', async () => {
  // keepPreviousData renders the PREVIOUS envelope while a genuinely new query
  // key (never fetched before) is in flight. Reaching such a key requires a
  // combination — here status+sort — that was never visited unfiltered: the
  // mount fetch warms {status:'',sort:applicationDate}, filtering to Offer
  // warms {status:'Offer',sort:applicationDate} (total 0), then sorting by
  // position while still filtered warms {status:'Offer',sort:position} (also
  // total 0, real, settled). Clearing the filter from there targets
  // {status:'',sort:position} — never cached — so its placeholder is the
  // just-settled Offer/position total of 0, and hasFilters flips false the
  // instant Clear is clicked. A naive `total === 0 && !hasFilters` reads that
  // stale placeholder zero and tells a user with 137 applications that they
  // have none. (Sort, not page size, drives the mismatch here because the
  // Pager — and so the page-size control — is hidden while total is 0.)
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([])),
    http.get(`${API_V2}/applications`, async ({ request }) => {
      const status = new URL(request.url).searchParams.get('status');
      if (status === 'Offer') {
        return HttpResponse.json({ items: [], page: 1, pageSize: 25, total: 0, totalPages: 0 });
      }
      // A real delay, not an instant microtask resolution: without it, the
      // in-flight placeholder render and the final resolved render land in
      // the same act() flush and a synchronous assertion can never observe
      // the intermediate (buggy) state — even though React did render it.
      await delay(60);
      return HttpResponse.json({
        items: [{ id: 'a1', position: 'Backend Eng', status: 'Applied' }],
        page: 1, pageSize: 25, total: 137, totalPages: 6,
      });
    }),
  );
  localStorage.setItem('applicationsView', 'list');
  renderPage();
  await screen.findByText('Backend Eng');
  await userEvent.selectOptions(screen.getByLabelText(/filter by status/i), 'Offer');
  await waitFor(() => expect(screen.getByText('No applications match your filters.')).toBeInTheDocument());
  await userEvent.click(screen.getByRole('button', { name: /sort by position/i }));
  await waitFor(() => expect(screen.getByText('No applications match your filters.')).toBeInTheDocument());
  await userEvent.click(screen.getByRole('button', { name: /^clear$/i }));
  // Checked repeatedly across the in-flight window (the delayed request is
  // still pending here), not just at the end — the bug was a mid-transition
  // flash, not a final-state error.
  expect(screen.queryByText(/no applications yet/i)).not.toBeInTheDocument();
  await new Promise((r) => { setTimeout(r, 25); });
  expect(screen.queryByText(/no applications yet/i)).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getByText('Backend Eng')).toBeInTheDocument());
  expect(screen.queryByText(/no applications yet/i)).not.toBeInTheDocument();
});

test('clearing a no-match search never flashes "No applications yet" while the debounce catches up', async () => {
  // `hasFilters` reads the RAW `search` state, so it flips false the instant
  // the input is cleared. `term` — what the query key is actually built from
  // — is debounced 300ms behind it, so for that whole window the settled,
  // non-placeholder envelope in cache still belongs to the just-cleared
  // no-match search (total 0). A `settled` computation that doesn't also wait
  // for `search.trim() === term` reads that stale zero as "no applications at
  // all" the moment `hasFilters` goes false, instead of waiting for the query
  // key itself to catch up to the cleared search.
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([])),
    http.get(`${API_V2}/applications`, ({ request }) => {
      const search = new URL(request.url).searchParams.get('search') || '';
      if (search === 'zzz') {
        return HttpResponse.json({ items: [], page: 1, pageSize: 25, total: 0, totalPages: 0 });
      }
      return HttpResponse.json({
        items: [{ id: 'a1', position: 'Backend Eng', status: 'Applied' }],
        page: 1, pageSize: 25, total: 137, totalPages: 6,
      });
    }),
  );
  localStorage.setItem('applicationsView', 'list');
  renderPage();
  await screen.findByText('Backend Eng');
  const input = screen.getByPlaceholderText(/search applications/i);
  await userEvent.type(input, 'zzz');
  await waitFor(() => expect(screen.getByText('No applications match your filters.')).toBeInTheDocument());
  await userEvent.clear(input);
  // Checked repeatedly across the debounce window the fix has to survive, not
  // just at the end — the bug is a mid-transition flash, and it appears right
  // at the moment `hasFilters` flips, before `term` has had any chance to
  // catch up.
  expect(screen.queryByText(/no applications yet/i)).not.toBeInTheDocument();
  await new Promise((r) => { setTimeout(r, 100); });
  expect(screen.queryByText(/no applications yet/i)).not.toBeInTheDocument();
  await new Promise((r) => { setTimeout(r, 150); });
  expect(screen.queryByText(/no applications yet/i)).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getByText('Backend Eng')).toBeInTheDocument());
  expect(screen.queryByText(/no applications yet/i)).not.toBeInTheDocument();
});
