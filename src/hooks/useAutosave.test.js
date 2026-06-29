import { renderHook } from '@testing-library/react';
import { useAutosave } from './useAutosave';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test('does not save on initial mount', () => {
  const onSave = vi.fn();
  renderHook(({ v }) => useAutosave(v, onSave, 1000), { initialProps: { v: 'a' } });
  vi.advanceTimersByTime(2000);
  expect(onSave).not.toHaveBeenCalled();
});

test('saves once after the debounce delay following a change', () => {
  const onSave = vi.fn();
  const { rerender } = renderHook(({ v }) => useAutosave(v, onSave, 1000), { initialProps: { v: 'a' } });
  rerender({ v: 'b' });
  vi.advanceTimersByTime(999);
  expect(onSave).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(onSave).toHaveBeenCalledTimes(1);
  expect(onSave).toHaveBeenCalledWith('b');
});

test('debounces rapid changes to a single save with the latest value', () => {
  const onSave = vi.fn();
  const { rerender } = renderHook(({ v }) => useAutosave(v, onSave, 1000), { initialProps: { v: 'a' } });
  rerender({ v: 'b' });
  vi.advanceTimersByTime(500);
  rerender({ v: 'c' });
  vi.advanceTimersByTime(500);
  expect(onSave).not.toHaveBeenCalled();
  vi.advanceTimersByTime(500);
  expect(onSave).toHaveBeenCalledTimes(1);
  expect(onSave).toHaveBeenCalledWith('c');
});
