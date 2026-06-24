import { useRef, useState } from 'react';
import {
  DndContext, useDraggable, useDroppable,
  PointerSensor, KeyboardSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, AlertCircle, Maximize2, Search } from 'lucide-react';
import { listApplications, updateStatus } from '../api/applications';
import Button from '../components/Button';
import ApplicationDrawer from '../components/ApplicationDrawer';
import { STATUSES } from '../lib/applicationStatus';

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

const fmtSalary = (min, max) => {
  if (min == null && max == null) return null;
  const k = (n) => `$${Math.round(n / 1000)}k`;
  if (min != null && max != null) return `${k(min)}–${k(max)}`;
  return k(min ?? max);
};

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
  const salary = fmtSalary(app.salaryMin, app.salaryMax);
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
          {salary && <span className="mt-1 inline-block rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700">{salary}</span>}
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

export default function Applications() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [drawer, setDrawer] = useState({ open: false, application: null });
  const openDrawer = (application) => setDrawer({ open: true, application });
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );
  const { data: apps = [], isLoading } = useQuery({ queryKey: ['applications'], queryFn: listApplications });

  const term = search.trim().toLowerCase();
  const visible = term ? apps.filter((a) => a.position.toLowerCase().includes(term)) : apps;

  const move = useMutation(moveMutationOptions(qc));

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
        <p className="text-slate-500">Loading…</p>
      ) : (
        <>
          {apps.length === 0 && (
            <p className="mb-3 text-sm text-slate-500">
              No applications yet — click <span className="font-medium">New application</span> to add your first one, then drag it across the board as you progress.
            </p>
          )}
          {apps.length > 0 && visible.length === 0 && (
            <p className="mb-3 text-sm text-slate-500">No applications match your search.</p>
          )}
          <DndContext sensors={sensors} onDragEnd={onDragEnd}>
            <div className="flex gap-3 overflow-x-auto pb-4">
              {STATUSES.map((s) => (
                <Column key={s} status={s} apps={visible.filter((a) => a.status === s)} onOpen={openDrawer} />
              ))}
            </div>
          </DndContext>
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
