import { useEffect, useRef, useState } from 'react';
import {
  DndContext, useDraggable, useDroppable,
  PointerSensor, KeyboardSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, AlertCircle, Maximize2, Search, LayoutGrid, List, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { listApplications, updateStatus } from '../api/applications';
import Button from '../components/Button';
import ApplicationDrawer from '../components/ApplicationDrawer';
import Spinner from '../components/Spinner';
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

// Optimistic-move mutation config, extracted so the cache logic (the interesting
// part) is unit-testable independently of pointer-based drag events.
export function moveMutationOptions(qc) {
  return {
    mutationFn: ({ id, status }) => updateStatus(id, status),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ['applications'] });
      const prev = qc.getQueryData(['applications']);
      qc.setQueryData(['applications'], (old = []) => old.map((a) => (a.id === id ? { ...a, status } : a)));
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(['applications'], ctx.prev); },
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

// Pure comparators per sortable column. Salary sorts by the upper bound (falling
// back to the lower); missing values sort last in ascending order.
const SORTS = {
  position: (a, b) => a.position.localeCompare(b.position),
  company: (a, b) => (a.company?.name || '').localeCompare(b.company?.name || ''),
  status: (a, b) => STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status),
  salary: (a, b) => (a.salaryMax ?? a.salaryMin ?? -1) - (b.salaryMax ?? b.salaryMin ?? -1),
  applicationDate: (a, b) => new Date(a.applicationDate || 0) - new Date(b.applicationDate || 0),
};

const COLUMNS = [
  { key: 'position', label: 'Position' },
  { key: 'company', label: 'Company' },
  { key: 'status', label: 'Status' },
  { key: 'salary', label: 'Salary' },
  { key: 'applicationDate', label: 'Applied' },
];

const dash = <span className="text-slate-300">—</span>;

export function sortApps(apps, { key, dir }) {
  const cmp = SORTS[key];
  if (!cmp) return apps;
  const out = [...apps].sort(cmp);
  return dir === 'desc' ? out.reverse() : out;
}

function ListView({ apps, sort, onSort, onOpen, onStatusChange }) {
  const rows = sortApps(apps, sort);
  return (
    <div className="overflow-x-auto rounded-xl border border-sky-100 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
            {COLUMNS.map((c) => {
              const active = sort.key === c.key;
              const SortIcon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
              return (
                <th key={c.key} scope="col" className="px-4 py-3 font-semibold">
                  <button
                    type="button"
                    onClick={() => onSort(c.key)}
                    aria-label={`Sort by ${c.label}`}
                    className="inline-flex items-center gap-1 cursor-pointer hover:text-slate-700"
                  >
                    {c.label}
                    <SortIcon size={12} aria-hidden="true" className={active ? '' : 'text-slate-300'} />
                  </button>
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
  const [drawer, setDrawer] = useState({ open: false, application: null });
  const openDrawer = (application) => setDrawer({ open: true, application });
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );
  const { data: apps = [], isLoading } = useQuery({ queryKey: ['applications'], queryFn: listApplications });

  useEffect(() => { localStorage.setItem('applicationsView', view); }, [view]);

  // Company filter options derived from the loaded applications (only companies
  // that actually have applications show up — no empty choices, no extra query).
  const companyOptions = [...new Map(apps.filter((a) => a.company).map((a) => [a.company.id, a.company.name])).entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((x, y) => x.name.localeCompare(y.name));

  const term = search.trim().toLowerCase();
  const hasFilters = Boolean(term || statusFilter || companyFilter);
  const visible = apps.filter((a) => {
    if (statusFilter && a.status !== statusFilter) return false;
    if (companyFilter && a.company?.id !== companyFilter) return false;
    if (term && !(a.position.toLowerCase().includes(term) || (a.company?.name || '').toLowerCase().includes(term))) return false;
    return true;
  });
  const shownStatuses = statusFilter ? [statusFilter] : STATUSES;
  const clearFilters = () => { setSearch(''); setStatusFilter(''); setCompanyFilter(''); };

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
        <div className="relative max-w-md flex-1">
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
        <select
          aria-label="Filter by status"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
        </select>
        <select
          aria-label="Filter by company"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          value={companyFilter}
          onChange={(e) => setCompanyFilter(e.target.value)}
        >
          <option value="">All companies</option>
          {companyOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
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
          {apps.length === 0 && (
            <p className="mb-3 text-sm text-slate-500">
              No applications yet — click <span className="font-medium">New application</span> to add your first one, then drag it across the board as you progress.
            </p>
          )}
          {apps.length > 0 && visible.length === 0 && (
            <p className="mb-3 text-sm text-slate-500">No applications match your filters.</p>
          )}
          {view === 'list' ? (
            <ListView apps={visible} sort={sort} onSort={onSort} onOpen={openDrawer} onStatusChange={onStatusChange} />
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
