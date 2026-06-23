import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../test/utils';
import App from '../App';

test('redirects to /login when not authenticated', async () => {
  renderWithProviders(<App />, { route: '/companies' });
  await waitFor(() => expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument());
});
