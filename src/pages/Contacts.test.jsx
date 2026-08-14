import { http, HttpResponse, delay } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server, API, API_V2 } from '../test/server';
import Contacts from './Contacts';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><Contacts /></QueryClientProvider>);
}

const page = (items, over = {}) => ({
  items, page: 1, pageSize: 25, total: items.length, totalPages: items.length ? 1 : 0, ...over,
});

beforeEach(() => {
  server.use(http.get(`${API}/companies`, () => HttpResponse.json([])));
});

test('lists contacts from the API', async () => {
  server.use(http.get(`${API_V2}/contacts`, () => HttpResponse.json(page([
    { id: '1', name: 'Jane Recruiter', position: 'Recruiter', company: { id: 'c1', name: 'Acme' }, email: 'jane@acme.com', linkedinUrl: '', followUpDate: null },
  ]))));
  renderPage();
  await waitFor(() => expect(screen.getByText('Jane Recruiter')).toBeInTheDocument());
  expect(screen.getByText('Recruiter · Acme')).toBeInTheDocument();
});

test('search refetches with the term', async () => {
  server.use(http.get(`${API_V2}/contacts`, ({ request }) => {
    const term = new URL(request.url).searchParams.get('search');
    return HttpResponse.json(page(term === 'jan'
      ? [{ id: '1', name: 'Jane', position: '', company: null, email: '', linkedinUrl: '', followUpDate: null }]
      : [
          { id: '1', name: 'Jane', position: '', company: null, email: '', linkedinUrl: '', followUpDate: null },
          { id: '2', name: 'Bob', position: '', company: null, email: '', linkedinUrl: '', followUpDate: null },
        ]));
  }));
  renderPage();
  await waitFor(() => expect(screen.getByText('Bob')).toBeInTheDocument());
  await userEvent.type(screen.getByPlaceholderText(/search contacts/i), 'jan');
  await waitFor(() => expect(screen.queryByText('Bob')).not.toBeInTheDocument());
  expect(screen.getByText('Jane')).toBeInTheDocument();
});

test('Add contact opens the drawer in create mode', async () => {
  server.use(http.get(`${API_V2}/contacts`, () => HttpResponse.json(page([]))));
  renderPage();
  await userEvent.click(screen.getByRole('button', { name: /add contact/i }));
  expect(await screen.findByRole('dialog', { name: /new contact/i })).toBeInTheDocument();
});

test('Edit on a card opens the drawer pre-filled', async () => {
  server.use(http.get(`${API_V2}/contacts`, () => HttpResponse.json(page([
    { id: '1', name: 'Jane Recruiter', position: 'Recruiter', company: null, email: '', linkedinUrl: '', followUpDate: null },
  ]))));
  renderPage();
  await userEvent.click(await screen.findByRole('button', { name: /edit jane recruiter/i }));
  const dialog = await screen.findByRole('dialog', { name: /contact/i });
  await waitFor(() => expect(screen.getByLabelText(/^name$/i)).toHaveValue('Jane Recruiter'));
  expect(dialog).toBeInTheDocument();
});

test('delete removes a contact', async () => {
  let deleted = false;
  const items = [{ id: '1', name: 'Jane', position: '', company: null, email: '', linkedinUrl: '', followUpDate: null }];
  server.use(
    http.get(`${API_V2}/contacts`, () => HttpResponse.json(page(deleted ? [] : items))),
    http.delete(`${API}/contacts/1`, () => { deleted = true; return new HttpResponse(null, { status: 204 }); }),
  );
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  renderPage();
  await userEvent.click(await screen.findByRole('button', { name: /delete jane/i }));
  await waitFor(() => expect(screen.queryByText('Jane')).not.toBeInTheDocument());
  window.confirm.mockRestore();
});

test('delete refetches the list even while a search is active', async () => {
  let items = [
    { id: '1', name: 'Jane', position: '', company: null, email: '', linkedinUrl: '', followUpDate: null },
    { id: '2', name: 'Janet', position: '', company: null, email: '', linkedinUrl: '', followUpDate: null },
  ];
  server.use(
    http.get(`${API_V2}/contacts`, ({ request }) => {
      const term = new URL(request.url).searchParams.get('search');
      const filtered = term ? items.filter((c) => c.name.toLowerCase().includes(term.toLowerCase())) : items;
      return HttpResponse.json(page(filtered));
    }),
    http.delete(`${API}/contacts/1`, () => { items = items.filter((c) => c.id !== '1'); return new HttpResponse(null, { status: 204 }); }),
  );
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  renderPage();
  await userEvent.type(screen.getByPlaceholderText(/search contacts/i), 'jan');
  await waitFor(() => expect(screen.getByText('Jane')).toBeInTheDocument());
  expect(screen.getByText('Janet')).toBeInTheDocument();
  // Delete 'Jane' (exact accessible name avoids matching 'Janet'); list is keyed ['contacts','page',params].
  await userEvent.click(screen.getByRole('button', { name: 'Delete Jane' }));
  await waitFor(() => expect(screen.queryByText('Jane')).not.toBeInTheDocument());
  expect(screen.getByText('Janet')).toBeInTheDocument();
  window.confirm.mockRestore();
});

test('asks for page 1 at the default size and shows the count', async () => {
  let seen = null;
  server.use(http.get(`${API_V2}/contacts`, ({ request }) => {
    seen = Object.fromEntries(new URL(request.url).searchParams);
    return HttpResponse.json({
      items: [{ id: '1', name: 'Jane', position: '', company: null, email: '', linkedinUrl: '', followUpDate: null }],
      page: 1, pageSize: 25, total: 60, totalPages: 3,
    });
  }));
  renderPage();
  await waitFor(() => expect(screen.getByText('1–25 of 60')).toBeInTheDocument());
  expect(seen).toEqual({ page: '1', pageSize: '25', sort: 'createdAt', dir: 'desc' });
});

test('search is debounced, sent to the server, and resets the page', async () => {
  const seen = [];
  server.use(http.get(`${API_V2}/contacts`, ({ request }) => {
    const q = new URL(request.url).searchParams;
    seen.push({ page: q.get('page'), search: q.get('search') });
    return HttpResponse.json({
      items: [{ id: '1', name: 'Jane', position: '', company: null, email: '', linkedinUrl: '', followUpDate: null }],
      page: Number(q.get('page')), pageSize: 25, total: 60, totalPages: 3,
    });
  }));
  renderPage();
  await screen.findByText('Jane');
  await userEvent.click(screen.getByRole('button', { name: /next page/i }));
  await waitFor(() => expect(seen.at(-1).page).toBe('2'));
  await userEvent.type(screen.getByPlaceholderText(/search contacts/i), 'jan');
  await waitFor(() => expect(seen.at(-1)).toEqual({ page: '1', search: 'jan' }));
  expect(seen.filter((s) => s.search).map((s) => s.search)).toEqual(['jan']); // one request, not three
});

test('an empty result shows the empty state and no pager', async () => {
  server.use(http.get(`${API_V2}/contacts`, () => HttpResponse.json(page([]))));
  renderPage();
  await waitFor(() => expect(screen.getByText(/no contacts yet/i)).toBeInTheDocument());
  expect(screen.queryByRole('navigation', { name: /pagination/i })).not.toBeInTheDocument();
});

test('a genuinely never-cached search key does not flash "No contacts yet" over real data', async () => {
  // keepPreviousData renders the PREVIOUS envelope while a genuinely new query
  // key (never fetched before) is in flight. The obvious repro — search for
  // nothing, then clear — does not reach that path here: clearing back to ''
  // returns to the mount key, which is already warmed from the initial render,
  // so the query is served from cache and never enters the placeholder path.
  // Reaching a never-cached key instead requires searching for one term with
  // no matches, then a *different*, never-before-typed term that *does* match
  // — the transition into that second term's key is what is never cached.
  const requested = [];
  server.use(http.get(`${API_V2}/contacts`, async ({ request }) => {
    const search = new URL(request.url).searchParams.get('search') || '';
    requested.push(search);
    if (search === 'nomatch') {
      return HttpResponse.json({ items: [], page: 1, pageSize: 25, total: 0, totalPages: 0 });
    }
    if (search === 'jane') {
      // A real delay, not an instant microtask resolution: without it, the
      // in-flight placeholder render and the final resolved render land in
      // the same act() flush and a synchronous assertion can never observe
      // the intermediate (buggy) state — even though React did render it.
      await delay(60);
      return HttpResponse.json({
        items: [{ id: '1', name: 'Jane', position: '', company: null, email: '', linkedinUrl: '', followUpDate: null }],
        page: 1, pageSize: 25, total: 137, totalPages: 6,
      });
    }
    return HttpResponse.json({
      items: [{ id: '2', name: 'Bob', position: '', company: null, email: '', linkedinUrl: '', followUpDate: null }],
      page: 1, pageSize: 25, total: 137, totalPages: 6,
    });
  }));
  renderPage();
  await screen.findByText('Bob');

  const input = screen.getByPlaceholderText(/search contacts/i);
  await userEvent.type(input, 'nomatch');
  await waitFor(() => expect(screen.getByText(/no contacts yet/i)).toBeInTheDocument());

  await userEvent.clear(input);
  await userEvent.type(input, 'jane');
  // Confirms the debounce fired and the request for 'jane' is in flight — the
  // window in which keepPreviousData is serving the stale 'nomatch' envelope
  // (total: 0) while isFetching/isPlaceholderData are true.
  await waitFor(() => expect(requested).toContain('jane'));
  expect(screen.queryByText(/no contacts yet/i)).not.toBeInTheDocument();

  await waitFor(() => expect(screen.getByText('Jane')).toBeInTheDocument());
  expect(screen.queryByText(/no contacts yet/i)).not.toBeInTheDocument();
});
