import { act, renderHook } from '@testing-library/react';
import { pageWindow, rangeLabel, useClampedPage, useDebouncedValue } from './pagination';
import { compactParams } from '../api/params';

test('rangeLabel reads as "first–last of total"', () => {
  expect(rangeLabel({ page: 1, pageSize: 25, total: 137 })).toBe('1–25 of 137');
  expect(rangeLabel({ page: 6, pageSize: 25, total: 137 })).toBe('126–137 of 137'); // partial last page
  expect(rangeLabel({ page: 1, pageSize: 25, total: 3 })).toBe('1–3 of 3');
});

test('rangeLabel says nothing numeric when there is nothing to count', () => {
  // "0–0 of 0" reads as a bug, and totalPages is 0 (not 1) for an empty result.
  expect(rangeLabel({ page: 1, pageSize: 25, total: 0 })).toBe('No results');
});

test('pageWindow keeps the first and last page and elides the runs between', () => {
  expect(pageWindow(1, 1)).toEqual([1]);
  expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
  expect(pageWindow(2, 5)).toEqual([1, 2, 3, null, 5]);
  expect(pageWindow(5, 10)).toEqual([1, null, 4, 5, 6, null, 10]);
  expect(pageWindow(10, 10)).toEqual([1, null, 9, 10]);
});

test('pageWindow renders nothing for an empty result', () => {
  expect(pageWindow(1, 0)).toEqual([]);
});

test('compactParams drops blanks so v2 validation is not tripped by an empty filter', () => {
  // v2 validates rather than coerces: search is min(1) after trim, companyId is
  // a uuid, status is an enum. `?search=` is a 400, not "no filter".
  expect(compactParams({ page: 1, search: '', status: undefined, companyId: null, sort: 'createdAt' }))
    .toEqual({ page: 1, sort: 'createdAt' });
  expect(compactParams({ page: 1, pageSize: 25 })).toEqual({ page: 1, pageSize: 25 });
});

describe('useDebouncedValue', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test('holds the previous value until the delay elapses', () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 300), { initialProps: { v: 'a' } });
    expect(result.current).toBe('a');
    rerender({ v: 'ab' });
    expect(result.current).toBe('a');
    act(() => vi.advanceTimersByTime(299));
    expect(result.current).toBe('a');
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe('ab');
  });

  test('a keystroke inside the window restarts it, so only the last value lands', () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 300), { initialProps: { v: 'a' } });
    rerender({ v: 'ab' });
    act(() => vi.advanceTimersByTime(200));
    rerender({ v: 'abc' });
    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe('a');
    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe('abc');
  });
});

describe('useClampedPage', () => {
  test('steps back to the last real page when the current one is past the end', () => {
    // Deleting the only row on page 4 leaves the client asking for a page the
    // API answers as valid-but-empty. Recover from the truthful totalPages.
    const setPage = vi.fn();
    renderHook(() => useClampedPage(4, 3, setPage));
    expect(setPage).toHaveBeenCalledWith(3);
  });

  test('does nothing while the page is in range', () => {
    const setPage = vi.fn();
    renderHook(() => useClampedPage(2, 3, setPage));
    expect(setPage).not.toHaveBeenCalled();
  });

  test('does nothing on an empty result, which has zero pages and no page to fall back to', () => {
    const setPage = vi.fn();
    renderHook(() => useClampedPage(1, 0, setPage));
    expect(setPage).not.toHaveBeenCalled();
  });
});
