import { http, HttpResponse } from 'msw';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server, API } from '../test/server';
import { renderWithProviders } from '../test/utils';
import App from '../App';

test('logging in stores the session and navigates to the dashboard', async () => {
  server.use(
    http.post(`${API}/auth/login`, () => HttpResponse.json({ user: { id: '1', email: 'ada@x.com', name: 'Ada' }, accessToken: 't' })),
    http.get(`${API}/dashboard/summary`, () => HttpResponse.json({ totalApplications: 0, byStatus: {}, upcomingInterviews: [] })),
  );
  renderWithProviders(<App />, { route: '/login' });
  await userEvent.type(screen.getByLabelText(/email/i), 'ada@x.com');
  await userEvent.type(screen.getByLabelText(/password/i), 'Password123');
  await userEvent.click(screen.getByRole('button', { name: /log in/i }));
  await waitFor(() => expect(screen.getByRole('heading', { name: /Dashboard/i })).toBeInTheDocument());
});

test('keep me logged in is checked by default and sent as rememberMe', async () => {
  let body = null;
  server.use(
    http.post(`${API}/auth/login`, async ({ request }) => {
      body = await request.json();
      return HttpResponse.json({ user: { id: '1', email: 'ada@x.com', name: 'Ada' }, accessToken: 't' });
    }),
    http.get(`${API}/dashboard/summary`, () => HttpResponse.json({ totalApplications: 0, byStatus: {}, upcomingInterviews: [] })),
  );
  renderWithProviders(<App />, { route: '/login' });
  expect(screen.getByRole('checkbox', { name: /keep me logged in/i })).toBeChecked();
  await userEvent.type(screen.getByLabelText(/email/i), 'ada@x.com');
  await userEvent.type(screen.getByLabelText(/password/i), 'Password123');
  await userEvent.click(screen.getByRole('button', { name: /log in/i }));
  await waitFor(() => expect(body).toMatchObject({ rememberMe: true }));
});

test('unchecking keep me logged in sends rememberMe false', async () => {
  let body = null;
  server.use(
    http.post(`${API}/auth/login`, async ({ request }) => {
      body = await request.json();
      return HttpResponse.json({ user: { id: '1', email: 'ada@x.com', name: 'Ada' }, accessToken: 't' });
    }),
    http.get(`${API}/dashboard/summary`, () => HttpResponse.json({ totalApplications: 0, byStatus: {}, upcomingInterviews: [] })),
  );
  renderWithProviders(<App />, { route: '/login' });
  await userEvent.click(screen.getByRole('checkbox', { name: /keep me logged in/i }));
  await userEvent.type(screen.getByLabelText(/email/i), 'ada@x.com');
  await userEvent.type(screen.getByLabelText(/password/i), 'Password123');
  await userEvent.click(screen.getByRole('button', { name: /log in/i }));
  await waitFor(() => expect(body).toMatchObject({ rememberMe: false }));
});

test('shows the API error message on bad credentials', async () => {
  server.use(http.post(`${API}/auth/login`, () =>
    HttpResponse.json({ error: { message: 'Invalid credentials', code: 'UNAUTHORIZED' } }, { status: 401 })));
  renderWithProviders(<App />, { route: '/login' });
  await userEvent.type(screen.getByLabelText(/email/i), 'ada@x.com');
  await userEvent.type(screen.getByLabelText(/password/i), 'wrong');
  await userEvent.click(screen.getByRole('button', { name: /log in/i }));
  await waitFor(() => expect(screen.getByText(/Invalid credentials/i)).toBeInTheDocument());
});
