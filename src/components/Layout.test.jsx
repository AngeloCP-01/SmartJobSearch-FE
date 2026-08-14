import { http, HttpResponse } from 'msw';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';
import { server, API } from '../test/server';
import Layout from './Layout';

function renderLayout() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <MemoryRouter initialEntries={['/']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Layout />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

test('renders a Contacts nav link', () => {
  renderLayout();
  expect(screen.getAllByRole('link', { name: /contacts/i }).length).toBeGreaterThan(0);
});

test('renders an Analytics nav link', () => {
  renderLayout();
  expect(screen.getAllByRole('link', { name: /analytics/i }).length).toBeGreaterThan(0);
});

test('renders a Reminders nav link', () => {
  renderLayout();
  expect(screen.getAllByRole('link', { name: /reminders/i }).length).toBeGreaterThan(0);
});

test('renders a Documents nav link', () => {
  renderLayout();
  expect(screen.getAllByRole('link', { name: /documents/i }).length).toBeGreaterThan(0);
});

test('renders an Activity nav link', () => {
  renderLayout();
  expect(screen.getAllByRole('link', { name: /activity/i }).length).toBeGreaterThan(0);
});

test('renders an Analysis nav link', () => {
  renderLayout();
  expect(screen.getAllByRole('link', { name: /analysis/i }).length).toBeGreaterThan(0);
});

test('shows the global progress bar while a request is in flight', async () => {
  server.use(http.get(`${API}/reminders`, () => new Promise(() => {}))); // never resolves
  renderLayout();
  expect(await screen.findByTestId('top-progress')).toBeInTheDocument();
});

test('hides the global progress bar once requests settle', async () => {
  server.use(http.get(`${API}/reminders`, () => HttpResponse.json({
    interviews: { upcoming: [], overdue: [] },
    followUps: { due: [], upcoming: [] },
    counts: { total: 0 },
  })));
  renderLayout();
  await waitFor(() => expect(screen.queryByTestId('top-progress')).not.toBeInTheDocument());
});

test('shows a badge with the reminders count', async () => {
  server.use(http.get(`${API}/reminders`, () => HttpResponse.json({
    interviews: { upcoming: [], overdue: [] },
    followUps: { due: [], upcoming: [] },
    counts: { total: 3, interviews: 2, followUps: 1 },
  })));
  renderLayout();
  await waitFor(() => expect(screen.getAllByLabelText('3 reminders').length).toBeGreaterThan(0));
});

test('keeps the mobile nav drawer closed until it is opened', () => {
  renderLayout();
  expect(screen.queryByRole('dialog', { name: /primary navigation/i })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /open menu/i })).toHaveAttribute('aria-expanded', 'false');
});

test('opens the mobile nav drawer from the menu trigger', async () => {
  const userEventInstance = userEvent.setup();
  renderLayout();
  await userEventInstance.click(screen.getByRole('button', { name: /open menu/i }));
  expect(await screen.findByRole('dialog', { name: /primary navigation/i })).toBeInTheDocument();
});

test('closes the mobile nav drawer after following a link in it', async () => {
  const userEventInstance = userEvent.setup();
  renderLayout();
  await userEventInstance.click(screen.getByRole('button', { name: /open menu/i }));
  const drawer = await screen.findByRole('dialog', { name: /primary navigation/i });
  await userEventInstance.click(within(drawer).getByRole('link', { name: /contacts/i }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: /primary navigation/i })).not.toBeInTheDocument());
});

test('closes the mobile nav drawer on Escape', async () => {
  const userEventInstance = userEvent.setup();
  renderLayout();
  await userEventInstance.click(screen.getByRole('button', { name: /open menu/i }));
  await screen.findByRole('dialog', { name: /primary navigation/i });
  await userEventInstance.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog', { name: /primary navigation/i })).not.toBeInTheDocument());
});

test('offers log out from inside the mobile nav drawer', async () => {
  const userEventInstance = userEvent.setup();
  renderLayout();
  await userEventInstance.click(screen.getByRole('button', { name: /open menu/i }));
  const drawer = await screen.findByRole('dialog', { name: /primary navigation/i });
  expect(within(drawer).getByRole('button', { name: /log out/i })).toBeInTheDocument();
});

test('keeps log out pinned outside the scrolling nav list', async () => {
  const userEventInstance = userEvent.setup();
  renderLayout();
  await userEventInstance.click(screen.getByRole('button', { name: /open menu/i }));
  const drawer = await screen.findByRole('dialog', { name: /primary navigation/i });
  const list = within(drawer).getByRole('navigation', { name: /primary/i });
  const logout = within(drawer).getByRole('button', { name: /log out/i });
  // The link list is the only scrolling region. Log out has to live outside it,
  // or on a short screen the 13-item nav pushes it past the bottom edge and out
  // of reach — which is exactly what happened before.
  expect(list).not.toContainElement(logout);
});

test('opens the privacy policy modal from the footer trigger', async () => {
  const userEventInstance = userEvent.setup();
  renderLayout();
  await userEventInstance.click(screen.getByRole('button', { name: /^privacy$/i }));
  expect(await screen.findByRole('dialog', { name: /privacy policy/i })).toBeInTheDocument();
});
