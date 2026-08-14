import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PAGE_SIZES, pageWindow, rangeLabel } from '../lib/pagination';

// min-h-11 / min-w-11 is 44px — the V3-27 touch-target floor.
const btn = 'inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 cursor-pointer hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500';
const current = 'inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-sky-700 bg-sky-700 px-3 text-sm font-semibold text-white';

// Shared by every offset-paginated list. Stacks into two rows on phones — count
// and size selector above, page buttons below — so a long page run never forces
// a horizontal pan at 375px; one row from sm up.
export default function Pager({ page, pageSize, total, totalPages, onPageChange, onPageSizeChange }) {
  // totalPages is 0 (not 1) for an empty result. Rendering "Page 1 of 1" over
  // nothing is a lie, so render nothing.
  if (!total) return null;

  const pages = pageWindow(page, totalPages);
  const go = (p) => { if (p >= 1 && p <= totalPages && p !== page) onPageChange(p); };

  return (
    <nav aria-label="Pagination" className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center justify-between gap-3 sm:justify-start">
        <p className="text-sm text-slate-500" aria-live="polite">{rangeLabel({ page, pageSize, total })}</p>
        <label className="flex items-center gap-2 text-sm text-slate-500">
          <span className="sr-only sm:not-sr-only">Rows</span>
          <select
            aria-label="Rows per page"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="min-h-11 rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-700 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => go(page - 1)} className={btn}>
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        {pages.map((p, i) => (p === null ? (
          // eslint-disable-next-line react/no-array-index-key
          <span key={`gap-${i}`} aria-hidden="true" className="px-1 text-slate-400">…</span>
        ) : (
          <button
            key={p}
            type="button"
            aria-label={`Page ${p}`}
            aria-current={p === page ? 'page' : undefined}
            onClick={() => go(p)}
            className={p === page ? current : btn}
          >
            {p}
          </button>
        )))}
        <button type="button" aria-label="Next page" disabled={page >= totalPages} onClick={() => go(page + 1)} className={btn}>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
