import { http, HttpResponse } from 'msw';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server, API } from '../test/server';
import { renderWithProviders } from '../test/utils';
import App from '../App';

test('renders the landing hero with a log-in link', async () => {
  renderWithProviders(<App />, { route: '/welcome' });
  expect(await screen.findByRole('heading', { name: /run your job search/i })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /log in/i })).toBeInTheDocument();
});

test('"Try the live demo" signs into the demo account and lands on the dashboard', async () => {
  let body = null;
  server.use(
    http.post(`${API}/auth/login`, async ({ request }) => {
      body = await request.json();
      return HttpResponse.json({ user: { id: 'demo', email: 'demo@smartjobsearch.app', name: 'Demo' }, accessToken: 't' });
    }),
    http.get(`${API}/dashboard/summary`, () => HttpResponse.json({ totalApplications: 0, byStatus: {}, upcomingInterviews: [] })),
  );
  renderWithProviders(<App />, { route: '/welcome' });
  await userEvent.click((await screen.findAllByRole('button', { name: /try the live demo/i }))[0]);
  await waitFor(() => expect(body).toMatchObject({ email: 'demo@smartjobsearch.app', rememberMe: true }));
  await waitFor(() => expect(screen.getByRole('heading', { name: /Dashboard/i })).toBeInTheDocument());
});
