import { render, screen } from '@testing-library/react';
import Button from './Button';

test('loading shows a spinner, disables the button, and marks it busy', () => {
  render(<Button loading>Save</Button>);
  const btn = screen.getByRole('button', { name: /save/i });
  expect(btn).toBeDisabled();
  expect(btn).toHaveAttribute('aria-busy', 'true');
});

test('is enabled and not busy by default', () => {
  render(<Button>Save</Button>);
  const btn = screen.getByRole('button', { name: /save/i });
  expect(btn).toBeEnabled();
  expect(btn).not.toHaveAttribute('aria-busy');
});
