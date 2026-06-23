import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server, API } from '../test/server';
import Companies from './Companies';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}><Companies /></QueryClientProvider>,
  );
}

test('lists companies from the API', async () => {
  server.use(http.get(`${API}/companies`, () => HttpResponse.json([
    { id: '1', name: 'Acme', industry: 'Tech' },
  ])));
  renderPage();
  await waitFor(() => expect(screen.getByText('Acme')).toBeInTheDocument());
});

test('creating a company refetches the list', async () => {
  const items = [];
  server.use(
    http.get(`${API}/companies`, () => HttpResponse.json(items)),
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
