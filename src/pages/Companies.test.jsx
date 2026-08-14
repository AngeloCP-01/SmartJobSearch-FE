import { http, HttpResponse, delay } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server, API, API_V2 } from '../test/server';
import Companies from './Companies';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}><Companies /></QueryClientProvider>,
  );
}

const page = (items, over = {}) => ({
  items, page: 1, pageSize: 25, total: items.length, totalPages: items.length ? 1 : 0, ...over,
});

test('lists companies from the API', async () => {
  server.use(http.get(`${API_V2}/companies`, () => HttpResponse.json(page([
    { id: '1', name: 'Acme', industry: 'Tech' },
  ]))));
  renderPage();
  await waitFor(() => expect(screen.getByText('Acme')).toBeInTheDocument());
});

test('creating a company refetches the page', async () => {
  const items = [];
  server.use(
    http.get(`${API_V2}/companies`, () => HttpResponse.json(page(items))),
    http.post(`${API_V2}/companies`, async ({ request }) => {
      const body = await request.json();
      const created = { id: '9', ...body };
      items.push(created);
      return HttpResponse.json(created, { status: 201 });
    }),
    // createCompany still goes through the v1 client; v2 is a complete surface
    // so either would work, but the write path is untouched by this plan.
    http.post(`${API}/companies`, async ({ request }) => {
      const body = await request.json();
      const created = { id: '9', ...body };
      items.push(created);
      return HttpResponse.json(created, { status: 201 });
    }),
  );
  renderPage();
  await userEvent.type(screen.getByPlaceholderText(/company name/i), 'Globex');
  await userEvent.click(screen.getByRole('button', { name: /add company/i }));
  await waitFor(() => expect(screen.getByText('Globex')).toBeInTheDocument());
});

test('asks for page 1 at the default size and shows the count', async () => {
  let seen = null;
  server.use(http.get(`${API_V2}/companies`, ({ request }) => {
    seen = Object.fromEntries(new URL(request.url).searchParams);
    return HttpResponse.json({ items: [{ id: '1', name: 'Acme' }], page: 1, pageSize: 25, total: 60, totalPages: 3 });
  }));
  renderPage();
  await waitFor(() => expect(screen.getByText('1–25 of 60')).toBeInTheDocument());
  expect(seen).toEqual({ page: '1', pageSize: '25', sort: 'createdAt', dir: 'desc' });
});

test('search is debounced, sent to the server, and resets the page', async () => {
  const seen = [];
  server.use(http.get(`${API_V2}/companies`, ({ request }) => {
    const q = new URL(request.url).searchParams;
    seen.push({ page: q.get('page'), search: q.get('search') });
    return HttpResponse.json({ items: [{ id: '1', name: 'Acme' }], page: Number(q.get('page')), pageSize: 25, total: 60, totalPages: 3 });
  }));
  renderPage();
  await screen.findByText('Acme');
  await userEvent.click(screen.getByRole('button', { name: /next page/i }));
  await waitFor(() => expect(seen.at(-1).page).toBe('2'));
  await userEvent.type(screen.getByPlaceholderText(/search companies/i), 'acme');
  await waitFor(() => expect(seen.at(-1)).toEqual({ page: '1', search: 'acme' }));
  expect(seen.filter((s) => s.search).map((s) => s.search)).toEqual(['acme']); // one request, not four
});

test('an empty result shows the empty state and no pager', async () => {
  server.use(http.get(`${API_V2}/companies`, () => HttpResponse.json({ items: [], page: 1, pageSize: 25, total: 0, totalPages: 0 })));
  renderPage();
  await waitFor(() => expect(screen.getByText(/no companies yet/i)).toBeInTheDocument());
  expect(screen.queryByRole('navigation', { name: /pagination/i })).not.toBeInTheDocument();
});

test('a genuinely never-cached search key does not flash "No companies yet" over real data', async () => {
  // keepPreviousData renders the PREVIOUS envelope while a genuinely new query
  // key (never fetched before) is in flight. The obvious repro — search for
  // nothing, then clear — does not reach that path here: clearing back to ''
  // returns to the mount key, which is already warmed from the initial render,
  // so the query is served from cache and never enters the placeholder path.
  // Reaching a never-cached key instead requires searching for one term with
  // no matches, then a *different*, never-before-typed term that *does* match
  // — the transition into that second term's key is what is never cached.
  const requested = [];
  server.use(http.get(`${API_V2}/companies`, async ({ request }) => {
    const search = new URL(request.url).searchParams.get('search') || '';
    requested.push(search);
    if (search === 'nomatch') {
      return HttpResponse.json({ items: [], page: 1, pageSize: 25, total: 0, totalPages: 0 });
    }
    if (search === 'acme') {
      // A real delay, not an instant microtask resolution: without it, the
      // in-flight placeholder render and the final resolved render land in
      // the same act() flush and a synchronous assertion can never observe
      // the intermediate (buggy) state — even though React did render it.
      await delay(60);
      return HttpResponse.json({ items: [{ id: '1', name: 'Acme' }], page: 1, pageSize: 25, total: 137, totalPages: 6 });
    }
    return HttpResponse.json({ items: [{ id: '2', name: 'Globex' }], page: 1, pageSize: 25, total: 137, totalPages: 6 });
  }));
  renderPage();
  await screen.findByText('Globex');

  const input = screen.getByPlaceholderText(/search companies/i);
  await userEvent.type(input, 'nomatch');
  await waitFor(() => expect(screen.getByText(/no companies yet/i)).toBeInTheDocument());

  await userEvent.clear(input);
  await userEvent.type(input, 'acme');
  // Confirms the debounce fired and the request for 'acme' is in flight — the
  // window in which keepPreviousData is serving the stale 'nomatch' envelope
  // (total: 0) while isFetching/isPlaceholderData are true.
  await waitFor(() => expect(requested).toContain('acme'));
  expect(screen.queryByText(/no companies yet/i)).not.toBeInTheDocument();

  await waitFor(() => expect(screen.getByText('Acme')).toBeInTheDocument());
  expect(screen.queryByText(/no companies yet/i)).not.toBeInTheDocument();
});
