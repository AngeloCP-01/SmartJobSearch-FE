import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';
import Layout from './Layout';

test('renders a Contacts nav link', () => {
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Layout />
      </MemoryRouter>
    </AuthProvider>,
  );
  const links = screen.getAllByRole('link', { name: /contacts/i });
  expect(links.length).toBeGreaterThan(0);
});
