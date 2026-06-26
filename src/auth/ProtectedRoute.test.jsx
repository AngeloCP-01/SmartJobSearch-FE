import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../test/utils';
import App from '../App';

test('redirects unauthenticated users to the public landing page', async () => {
  renderWithProviders(<App />, { route: '/companies' });
  await waitFor(() => expect(screen.getByRole('heading', { name: /run your job search/i })).toBeInTheDocument());
});
