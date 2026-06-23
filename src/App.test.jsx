import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

test('renders the app shell without crashing', async () => {
  const App = (await import('./App')).default;
  const qc = new QueryClient();
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><App routerless /></MemoryRouter>
    </QueryClientProvider>,
  );
  expect(screen.getByText(/Job Search CRM/i)).toBeInTheDocument();
});
