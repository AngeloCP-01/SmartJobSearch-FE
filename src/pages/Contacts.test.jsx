import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server, API } from '../test/server';
import Contacts from './Contacts';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><Contacts /></QueryClientProvider>);
}

beforeEach(() => {
  server.use(http.get(`${API}/companies`, () => HttpResponse.json([])));
});

test('lists contacts from the API', async () => {
  server.use(http.get(`${API}/contacts`, () => HttpResponse.json([
    { id: '1', name: 'Jane Recruiter', position: 'Recruiter', company: { id: 'c1', name: 'Acme' }, email: 'jane@acme.com', linkedinUrl: '', followUpDate: null },
  ])));
  renderPage();
  await waitFor(() => expect(screen.getByText('Jane Recruiter')).toBeInTheDocument());
  expect(screen.getByText('Recruiter · Acme')).toBeInTheDocument();
});

test('search refetches with the term', async () => {
  server.use(http.get(`${API}/contacts`, ({ request }) => {
    const term = new URL(request.url).searchParams.get('search');
    return HttpResponse.json(term === 'jan'
      ? [{ id: '1', name: 'Jane', position: '', company: null, email: '', linkedinUrl: '', followUpDate: null }]
      : [
          { id: '1', name: 'Jane', position: '', company: null, email: '', linkedinUrl: '', followUpDate: null },
          { id: '2', name: 'Bob', position: '', company: null, email: '', linkedinUrl: '', followUpDate: null },
        ]);
  }));
  renderPage();
  await waitFor(() => expect(screen.getByText('Bob')).toBeInTheDocument());
  await userEvent.type(screen.getByPlaceholderText(/search contacts/i), 'jan');
  await waitFor(() => expect(screen.queryByText('Bob')).not.toBeInTheDocument());
  expect(screen.getByText('Jane')).toBeInTheDocument();
});

test('Add contact opens the drawer in create mode', async () => {
  server.use(http.get(`${API}/contacts`, () => HttpResponse.json([])));
  renderPage();
  await userEvent.click(screen.getByRole('button', { name: /add contact/i }));
  expect(await screen.findByRole('dialog', { name: /new contact/i })).toBeInTheDocument();
});

test('Edit on a card opens the drawer pre-filled', async () => {
  server.use(http.get(`${API}/contacts`, () => HttpResponse.json([
    { id: '1', name: 'Jane Recruiter', position: 'Recruiter', company: null, email: '', linkedinUrl: '', followUpDate: null },
  ])));
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
    http.get(`${API}/contacts`, () => HttpResponse.json(deleted ? [] : items)),
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
    http.get(`${API}/contacts`, ({ request }) => {
      const term = new URL(request.url).searchParams.get('search');
      const filtered = term ? items.filter((c) => c.name.toLowerCase().includes(term.toLowerCase())) : items;
      return HttpResponse.json(filtered);
    }),
    http.delete(`${API}/contacts/1`, () => { items = items.filter((c) => c.id !== '1'); return new HttpResponse(null, { status: 204 }); }),
  );
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  renderPage();
  await userEvent.type(screen.getByPlaceholderText(/search contacts/i), 'jan');
  await waitFor(() => expect(screen.getByText('Jane')).toBeInTheDocument());
  expect(screen.getByText('Janet')).toBeInTheDocument();
  // Delete 'Jane' (exact accessible name avoids matching 'Janet'); list is keyed ['contacts','jan'].
  await userEvent.click(screen.getByRole('button', { name: 'Delete Jane' }));
  await waitFor(() => expect(screen.queryByText('Jane')).not.toBeInTheDocument());
  expect(screen.getByText('Janet')).toBeInTheDocument();
  window.confirm.mockRestore();
});
