import { render, screen } from '@testing-library/react';
import Spinner from './Spinner';

test('renders a status region with the loading label', () => {
  render(<Spinner />);
  expect(screen.getByRole('status')).toBeInTheDocument();
  expect(screen.getByText('Loading…')).toBeInTheDocument();
});

test('falls back to an sr-only label when no visible label is given', () => {
  render(<Spinner label="" />);
  expect(screen.getByText('Loading')).toBeInTheDocument();
});
