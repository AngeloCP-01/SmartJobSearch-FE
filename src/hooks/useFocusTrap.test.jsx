import { useRef } from 'react';
import { expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import useFocusTrap from './useFocusTrap';

function Harness({ active = true, onEscape = () => {} }) {
  const ref = useRef(null);
  useFocusTrap(ref, active, onEscape);
  if (!active) return null;
  return (
    <div ref={ref} role="dialog" aria-label="Harness">
      <button type="button">first</button>
      <button type="button">middle</button>
      <button type="button">last</button>
    </div>
  );
}

test('focuses the first focusable element when activated', () => {
  render(<Harness />);
  expect(screen.getByRole('button', { name: 'first' })).toHaveFocus();
});

test('calls onEscape when Escape is pressed', async () => {
  const onEscape = vi.fn();
  const user = userEvent.setup();
  render(<Harness onEscape={onEscape} />);
  await user.keyboard('{Escape}');
  expect(onEscape).toHaveBeenCalledTimes(1);
});

test('wraps focus forward from the last element to the first', async () => {
  const user = userEvent.setup();
  render(<Harness />);
  screen.getByRole('button', { name: 'last' }).focus();
  await user.tab();
  expect(screen.getByRole('button', { name: 'first' })).toHaveFocus();
});

test('wraps focus backward from the first element to the last', async () => {
  const user = userEvent.setup();
  render(<Harness />);
  screen.getByRole('button', { name: 'first' }).focus();
  await user.tab({ shift: true });
  expect(screen.getByRole('button', { name: 'last' })).toHaveFocus();
});

test('does nothing when inactive', async () => {
  const onEscape = vi.fn();
  const user = userEvent.setup();
  render(<Harness active={false} onEscape={onEscape} />);
  await user.keyboard('{Escape}');
  expect(onEscape).not.toHaveBeenCalled();
});
