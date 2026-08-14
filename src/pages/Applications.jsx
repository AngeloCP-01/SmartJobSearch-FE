import { useEffect, useRef, useState } from 'react';
import {
  DndContext, useDraggable, useDroppable,
  PointerSensor, KeyboardSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Plus, AlertCircle, Maximize2, Search, LayoutGrid, List, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { listApplications, listApplicationsPage, updateStatus } from '../api/applications';
import { listCompanies } from '../api/companies';
import Button from '../components/Button';
import ApplicationDrawer from '../components/ApplicationDrawer';
import Pager from '../components/Pager';
import Spinner from '../components/Spinner';
import { DEFAULT_PAGE_SIZE, useClampedPage, useDebouncedValue } from '../lib/pagination';
import { STATUSES } from '../lib/applicationStatus';
import { formatSalaryRange } from '../lib/salary';

export { STATUSES };

const STATUS_STYLES = {
  Draft: 'bg-slate-100 text-slate-700',
  Applied: 'bg-sky-100 text-sky-800',
  HR_Screening: 'bg-indigo-100 text-indigo-800',
  Technical_Interview: 'bg-violet-100 text-violet-800',
  Final_Interview: 'bg-amber-100 text-amber-800',
  Offer: 'bg-green-100 text-green-800',
  Accepted: 'bg-emerald-100 text-emerald-800',
  Rejected: 'bg-red-100 text-red-800',
  Withdrawn: 'bg-slate-100 text-slate-500',
};

const label = (status) => status.replace(/_/g, ' ');

const WORK_MODE = {
  Remote: { label: 'Remote', cls: 'bg-emerald-50 text-emerald-700' },
  Hybrid: { label: 'Hybrid', cls: 'bg-amber-50 text-amber-700' },
  OnSite: { label: 'On-site', cls: 'bg-slate-100 text-slate-600' },
};
function WorkModeChip({ mode }) {
  const m = WORK_MODE[mode];
  if (!m) return null;
  return <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${m.cls}`}>{m.label}</span>;
}

const fmtDate = (v) => (v ? new Date(v).toISOString().slice(0, 10) : null);

// Pure, unit-testable drop mapping. overId is the target column (a status id).
export function applyDrop({ activeId, overId }, doUpdate) {
  if (!activeId || !overId) return undefined;
  if (!STATUSES.includes(overId)) return undefined;
  return doUpdate(activeId, overId);
}

// The same application can sit in two caches at once: the bare ['applications']
// array the board and the four dropdowns read, and the ['applications','page',…]
// envelope the List view reads. An optimistic move has to patch whichever is
// mounted, so the updater is shape-aware rather than array-only.
export function patchAppStatus(data, id, status) {
  const move = (rows) => rows.map((a) => (a.id === id ? { ...a, status } : a));
  if (Array.isArray(data)) return move(data);
  if (data && Array.isArray(data.items)) return { ...data, items: move(data.items) };
  return data; // unfetched or an unexpected shape — leave it alone
}

// Optimistic-move mutation config, extracted so the cache logic (the interesting
// part) is unit-testable independently of pointer-based drag events.
export function moveMutationOptions(qc) {
  return {
    mutationFn: ({ id, status }) => updateStatus(id, status),
    onMutate: async ({ id, status }) => {
      // ['applications'] is a prefix, so this reaches the paginated key too.
      await qc.cancelQueries({ queryKey: ['applications'] });
      const prev = qc.getQueriesData({ queryKey: ['applications'] });
      qc.setQueriesData({ queryKey: ['applications'] }, (old) => patchAppStatus(old, id, status));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      for (const [key, data] of ctx?.prev ?? []) qc.setQueryData(key, data);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['applications'] });
      qc.invalidateQueries({ queryKey: ['activity'] });
    },
  };
}

function Card({ app, onOpen }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: app.id });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  const salary = formatSalaryRange(app.salaryMin, app.salaryMax);
  const applied = fmtDate(app.applicationDate);
  const downPos = useRef(null);

  // Open on a genuine click, but not after a drag (pointer moved) and not on a
  // keyboard-synthesized click (detail === 0) — Space/Enter belong to dnd-kit's
  // keyboard drag, and the ↗ button stays the accessible open affordance.
  const onPointerDownCapture = (e) => { downPos.current = { x: e.clientX, y: e.clientY }; };
  const handleCardClick = (e) => {
    if (e.detail === 0) return;
    const d = downPos.current;
    if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) return;
    onOpen(app);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={handleCardClick}
      onPointerDownCapture={onPointerDownCapture}
      className={`mb-2 rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-sm transition-shadow
        hover:border-sky-200 ${isDragging ? 'shadow-md ring-2 ring-sky-300' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div {...listeners} {...attributes} aria-label={`${app.position}, ${label(app.status)}`} className="flex-1 cursor-grab text-slate-800">
          <p className="font-medium">{app.position}</p>
          {app.company && <p className="text-xs text-slate-500">{app.company.name}</p>}
          {(salary || app.workMode) && (
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {salary && <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700">{salary}</span>}
              <WorkModeChip mode={app.workMode} />
            </div>
          )}
          {applied && <p className="mt-1 text-xs text-slate-400">Applied {applied}</p>}
        </div>
        <button
          type="button"
          aria-label={`Open ${app.position}`}
          onClick={(e) => { e.stopPropagation(); onOpen(app); }}
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer
            focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          <Maximize2 size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function Column({ status, apps, onOpen }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div ref={setNodeRef} className={`flex w-60 shrink-0 flex-col rounded-xl p-2 ${isOver ? 'bg-sky-50 ring-2 ring-sky-200' : 'bg-slate-50'}`}>
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[status]}`}>{label(status)}</h2>
        <span className="text-xs font-medium text-slate-400">{apps.length}</span>
      </div>
      {apps.map((a) => <Card key={a.id} app={a} onOpen={onOpen} />)}
    </div>
  );
}

function ViewToggle({ view, onChange }) {
  const opts = [
    { id: 'kanban', label: 'Board', Icon: LayoutGrid },
    { id: 'list', label: 'List', Icon: List },
  ];
  return (
    <div role="group" aria-label="View" className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5">
      {opts.map(({ id, label: lbl, Icon }) => {
        const active = view === id;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(id)}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium cursor-pointer transition-colors
              ${active ? 'bg-sky-700 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Icon size={15} aria-hidden="true" /> {lbl}
          </button>
        );
      })}
    </div>
  );
}

// `sortable` mirrors the server allowlist — v2 400s on anything else. Salary is
// displayed but not sortable: it is not a sort key, and sorting the 25 rows on
// screen would report the page maximum as the overall maximum.
const COLUMNS = [
  { key: 'position', label: 'Position', sortable: true },
  { key: 'company', label: 'Company', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'salary', label: 'Salary', sortable: false },
  { key: 'applicationDate', label: 'Applied', sortable: true },
];

const dash = <span className="text-slate-300">—</span>;

function ListView({ rows, sort, onSort, onOpen, onStatusChange }) {
  // `relative` matters: the sr-only header label is position:absolute, and
  // without a positioned ancestor it resolves against the initial containing
  // block — escaping this scrollbox and stretching the whole document's scroll
  // width to the table's, which scrolls the entire app sideways.
  return (
    <div className="relative overflow-x-auto rounded-xl border border-sky-100 bg-white shadow-sm">
      {/* min-width keeps the columns readable and makes the sideways scroll a
          deliberate gesture. Without it the table tries to fit a 375px screen
          and squeezes every cell into a multi-line wrap *and* still overflows. */}
      <table className="w-full min-w-[44rem] text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
            {COLUMNS.map((c) => {
              const active = c.sortable && sort.key === c.key;
              const SortIcon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
              return (
                <th key={c.key} scope="col" className="px-4 py-3 font-semibold">
                  {c.sortable ? (
                    <button
                      type="button"
                      onClick={() => onSort(c.key)}
                      aria-label={`Sort by ${c.label}`}
                      className="inline-flex items-center gap-1 cursor-pointer hover:text-slate-700"
                    >
                      {c.label}
                      <SortIcon size={12} aria-hidden="true" className={active ? '' : 'text-slate-300'} />
                    </button>
                  ) : c.label}
                </th>
              );
            })}
            <th scope="col" className="px-4 py-3"><span className="sr-only">Open</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr
              key={a.id}
              onClick={() => onOpen(a)}
              className="cursor-pointer border-b border-slate-50 last:border-0 hover:bg-sky-50/40"
            >
              <td className="px-4 py-3 font-medium text-slate-900">
                <span className="inline-flex items-center gap-2">{a.position}<WorkModeChip mode={a.workMode} /></span>
              </td>
              <td className="px-4 py-3 text-slate-600">{a.company?.name || dash}</td>
              <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                <select
                  aria-label={`Status for ${a.position}`}
                  value={a.status}
                  onChange={(e) => onStatusChange(a.id, e.target.value)}
                  className={`cursor-pointer rounded-full border-0 px-2.5 py-1 text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${STATUS_STYLES[a.status] || 'bg-slate-100 text-slate-600'}`}
                >
                  {STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
                </select>
              </td>
              <td className="px-4 py-3 text-slate-700">{formatSalaryRange(a.salaryMin, a.salaryMax) || dash}</td>
              <td className="px-4 py-3 text-slate-500">{fmtDate(a.applicationDate) || dash}</td>
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  aria-label={`Open ${a.position}`}
                  onClick={(e) => { e.stopPropagation(); onOpen(a); }}
                  className="text-slate-400 hover:text-sky-700 cursor-pointer"
                >
                  <Maximize2 size={15} aria-hidden="true" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Applications() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [view, setView] = useState(() => localStorage.getItem('applicationsView') || 'kanban');
  const [sort, setSort] = useState({ key: 'applicationDate', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [drawer, setDrawer] = useState({ open: false, application: null });
  const openDrawer = (application) => setDrawer({ open: true, application });
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const isList = view === 'list';
  // The board filters an already-loaded array, so its search is instant. Only
  // the List view's search costs a request, so only it is debounced.
  const term = useDebouncedValue(search, 300).trim();
  const boardTerm = search.trim().toLowerCase();

  // The board needs every row: one column per status, and dragging between
  // them. It stays on the unpaginated v1 call under the shared ['applications']
  // key — the same key the four dropdown pages read.
  const board = useQuery({ queryKey: ['applications'], queryFn: listApplications, enabled: !isList });

  // "One page" is a separate key from "all rows" on purpose. Writing a subset
  // into ['applications'] would truncate the Analysis / Interviews /
  // TailorResume / CoverLetter dropdowns, and present as missing data.
  const pageParams = {
    page, pageSize, sort: sort.key, dir: sort.dir, search: term, status: statusFilter, companyId: companyFilter,
  };
  const list = useQuery({
    queryKey: ['applications', 'page', pageParams],
    queryFn: () => listApplicationsPage(pageParams),
    enabled: isList,
    placeholderData: keepPreviousData, // no empty flash between pages
  });

  // Filter options come from the full companies list, not from the rows on
  // screen: a page only knows its own 25 companies, so deriving from it would
  // hide the company the user is looking for. The trade is a few companies with
  // no applications in the dropdown; the alternative is an unreachable filter.
  // Shares the drawers' ['companies'] cache, so it is usually already warm.
  const { data: allCompanies = [] } = useQuery({ queryKey: ['companies'], queryFn: () => listCompanies() });
  const companyOptions = [...allCompanies].sort((x, y) => x.name.localeCompare(y.name));

  useEffect(() => { localStorage.setItem('applicationsView', view); }, [view]);

  // Anything that reshapes the result set invalidates the page number —
  // otherwise a filter that shrinks the set strands the user on an empty page 7.
  useEffect(() => { setPage(1); }, [term, statusFilter, companyFilter, pageSize, sort.key, sort.dir]);
  useClampedPage(page, list.data?.totalPages ?? 0, setPage);

  const apps = board.data ?? [];
  const hasFilters = Boolean(search.trim() || statusFilter || companyFilter);
  const visible = apps.filter((a) => {
    if (statusFilter && a.status !== statusFilter) return false;
    if (companyFilter && a.company?.id !== companyFilter) return false;
    if (boardTerm && !(a.position.toLowerCase().includes(boardTerm) || (a.company?.name || '').toLowerCase().includes(boardTerm))) return false;
    return true;
  });
  const shownStatuses = statusFilter ? [statusFilter] : STATUSES;
  const clearFilters = () => { setSearch(''); setStatusFilter(''); setCompanyFilter(''); };

  const rows = list.data?.items ?? [];
  const total = list.data?.total ?? 0;
  const totalPages = list.data?.totalPages ?? 0;
  const isLoading = isList ? list.isLoading : board.isLoading;
  const nothingYet = isList ? total === 0 && !hasFilters : apps.length === 0;
  const nothingMatched = isList ? total === 0 && hasFilters : apps.length > 0 && visible.length === 0;

  const move = useMutation(moveMutationOptions(qc));
  const onStatusChange = (id, status) => move.mutate({ id, status });
  const onSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  function onDragEnd(event) {
    applyDrop(
      { activeId: event.active?.id, overId: event.over?.id },
      (id, status) => move.mutate({ id, status }),
    );
  }

  return (
    <div>
      <h1 className="mb-5 text-2xl font-bold text-slate-900">Applications</h1>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Search gets its own row on phones; sharing one with a status select
            leaves it too narrow to show a search term. */}
        <div className="relative w-full sm:max-w-md sm:flex-1">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-slate-900
              focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            placeholder="Search applications…"
            aria-label="Search applications"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {/* The two filters share one full-width row on phones. `sm:contents`
            dissolves this wrapper from sm up, so the desktop bar is unchanged. */}
        <div className="flex w-full gap-3 sm:contents">
        <select
          aria-label="Filter by status"
          className="min-w-0 flex-1 sm:flex-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
        </select>
        <select
          aria-label="Filter by company"
          className="min-w-0 flex-1 sm:flex-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          value={companyFilter}
          onChange={(e) => setCompanyFilter(e.target.value)}
        >
          <option value="">All companies</option>
          {companyOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        </div>
        {hasFilters && (
          <button type="button" onClick={clearFilters} className="text-sm font-medium text-sky-700 hover:underline cursor-pointer">
            Clear
          </button>
        )}
        <ViewToggle view={view} onChange={setView} />
        <Button onClick={() => openDrawer(null)}>
          <Plus size={16} aria-hidden="true" /> New application
        </Button>
      </div>

      {move.isError && (
        <div role="alert" className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle size={16} aria-hidden="true" /> Couldn’t move the application. Please try again.
        </div>
      )}

      {isLoading ? (
        <Spinner center />
      ) : (
        <>
          {nothingYet && (
            <p className="mb-3 text-sm text-slate-500">
              No applications yet — click <span className="font-medium">New application</span> to add your first one, then drag it across the board as you progress.
            </p>
          )}
          {nothingMatched && (
            <p className="mb-3 text-sm text-slate-500">No applications match your filters.</p>
          )}
          {isList ? (
            <>
              <ListView rows={rows} sort={sort} onSort={onSort} onOpen={openDrawer} onStatusChange={onStatusChange} />
              <Pager
                page={page}
                pageSize={pageSize}
                total={total}
                totalPages={totalPages}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </>
          ) : (
            <DndContext sensors={sensors} onDragEnd={onDragEnd}>
              <div className="flex gap-3 overflow-x-auto pb-4">
                {shownStatuses.map((s) => (
                  <Column key={s} status={s} apps={visible.filter((a) => a.status === s)} onOpen={openDrawer} />
                ))}
              </div>
            </DndContext>
          )}
        </>
      )}

      <ApplicationDrawer
        open={drawer.open}
        application={drawer.application}
        onClose={() => setDrawer({ open: false, application: null })}
      />
    </div>
  );
}
