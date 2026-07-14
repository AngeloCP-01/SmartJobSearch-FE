import { render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import AppErrorBoundary from './AppErrorBoundary';

const captureMock = vi.fn();
vi.mock('../observability/sentry', () => ({ captureError: (...a) => captureMock(...a) }));

function Boom() {
  throw new Error('kaboom');
}

afterEach(() => captureMock.mockReset());

test('renders children when there is no error', () => {
  render(<AppErrorBoundary variant="page"><p>hello</p></AppErrorBoundary>);
  expect(screen.getByText('hello')).toBeInTheDocument();
});

test('page variant: renders the page fallback and reports the error', () => {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {}); // silence React boundary log
  render(<AppErrorBoundary variant="page"><Boom /></AppErrorBoundary>);
  expect(screen.getByText(/this page hit an error/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  expect(captureMock).toHaveBeenCalledTimes(1);
  expect(captureMock.mock.calls[0][0]).toBeInstanceOf(Error);
  spy.mockRestore();
});

test('full variant: renders the full-page fallback with a reload button', () => {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  render(<AppErrorBoundary variant="full"><Boom /></AppErrorBoundary>);
  expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();
  spy.mockRestore();
});

test('a key change remounts the boundary and clears the error', () => {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const { rerender } = render(
    <AppErrorBoundary key="/a" variant="page"><Boom /></AppErrorBoundary>,
  );
  expect(screen.getByText(/this page hit an error/i)).toBeInTheDocument();
  rerender(
    <AppErrorBoundary key="/b" variant="page"><p>recovered</p></AppErrorBoundary>,
  );
  expect(screen.getByText('recovered')).toBeInTheDocument();
  spy.mockRestore();
});
