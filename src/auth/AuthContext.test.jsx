import { http, HttpResponse } from 'msw';
import { screen, waitFor } from '@testing-library/react';
import { server, API } from '../test/server';
import { renderWithProviders } from '../test/utils';
import { AuthProvider, useAuth } from './AuthContext';

function Probe() {
  const { status, user } = useAuth();
  return <div>status:{status} user:{user?.email || 'none'}</div>;
}

test('bootstraps to anonymous when there is no session', async () => {
  renderWithProviders(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(screen.getByText(/status:anonymous/)).toBeInTheDocument());
});

test('bootstraps to authenticated when /auth/me succeeds (via refresh)', async () => {
  server.use(
    http.post(`${API}/auth/refresh`, () => HttpResponse.json({ accessToken: 'fresh' })),
    http.get(`${API}/auth/me`, () => HttpResponse.json({ user: { id: '1', email: 'ada@x.com', name: 'Ada' } })),
  );
  renderWithProviders(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(screen.getByText(/user:ada@x.com/)).toBeInTheDocument());
});
