import { useEffect, useState } from 'react';

// Mirrors the backend allowlist in SmartJobSearchCRM-BE/src/shared/pagination.js.
// An out-of-list value is rejected with 400, never clamped, so this array is a
// contract: build every size selector off it rather than writing the four
// numbers a second time in JSX.
export const PAGE_SIZES = [10, 25, 50, 100];
export const DEFAULT_PAGE_SIZE = 25;

// "1–25 of 137". An empty result gets words, not numbers: totalPages is 0 for
// an empty list (not 1), and "0–0 of 0" reads as a bug rather than as a state.
export function rangeLabel({ page, pageSize, total }) {
  if (!total) return 'No results';
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  return `${first}–${last} of ${total}`;
}

// A short window of page numbers that always includes the first and last, with
// null standing in for an elided run. Keeps the pager one row wide at 375px
// however many pages there are.
export function pageWindow(page, totalPages, span = 1) {
  if (totalPages <= 0) return [];
  const wanted = new Set([1, totalPages]);
  for (let p = page - span; p <= page + span; p += 1) {
    if (p >= 1 && p <= totalPages) wanted.add(p);
  }
  const out = [];
  let prev = 0;
  for (const p of [...wanted].sort((a, b) => a - b)) {
    if (prev && p - prev > 1) out.push(null);
    out.push(p);
    prev = p;
  }
  return out;
}

// Search boxes drive a server request per change now that filtering is
// server-side; without this, every keystroke is a round trip and — at 25 rows a
// page — a visible flicker. Lives here rather than in a generic util because
// paginated search is the only thing that needs it.
export function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// Deleting the last row on the last page leaves `page` past the end. v2 answers
// that with a valid empty page and a truthful totalPages rather than a 404, so
// step back to the last real page instead of leaving the user staring at
// nothing. totalPages === 0 means the list is genuinely empty — stay put.
export function useClampedPage(page, totalPages, setPage) {
  useEffect(() => {
    if (totalPages > 0 && page > totalPages) setPage(totalPages);
  }, [page, totalPages, setPage]);
}

// Reset the page as part of the state change, not in an effect afterwards.
// useQuery's own internal effect runs on every render in hook-declaration
// order — it is declared above, before any effect we could add here — so an
// effect-based reset would dispatch one request for the stale page *before*
// it runs, and keepPreviousData would happily render that response on the
// way past. Resetting inside the handler means no render ever exists with a
// new search term/filter/page size and an old page.
export function pageResetter(setPage) {
  return (set) => (value) => { set(value); setPage(1); };
}
