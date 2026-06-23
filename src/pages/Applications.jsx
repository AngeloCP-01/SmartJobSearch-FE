import { useState } from 'react';
import { DndContext, useDraggable, useDroppable, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { listApplications, createApplication, updateStatus } from '../api/applications';
import Button from '../components/Button';

export const STATUSES = [
  'Draft', 'Applied', 'HR_Screening', 'Technical_Interview',
  'Final_Interview', 'Offer', 'Accepted', 'Rejected', 'Withdrawn',
];

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

// Pure, unit-testable drop mapping. overId is the target column (a status id).
export function applyDrop({ activeId, overId }, doUpdate) {
  if (!activeId || !overId) return undefined;
  if (!STATUSES.includes(overId)) return undefined;
  return doUpdate(activeId, overId);
}

function Card({ app }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: app.id });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`mb-2 cursor-grab rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-800
        shadow-sm transition-shadow ${isDragging ? 'shadow-md ring-2 ring-sky-300' : ''}`}
    >
      {app.position}
    </div>
  );
}

function Column({ status, apps }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div ref={setNodeRef} className={`flex w-60 shrink-0 flex-col rounded-xl p-2 ${isOver ? 'bg-sky-50 ring-2 ring-sky-200' : 'bg-slate-50'}`}>
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[status]}`}>{label(status)}</h2>
        <span className="text-xs font-medium text-slate-400">{apps.length}</span>
      </div>
      {apps.map((a) => <Card key={a.id} app={a} />)}
    </div>
  );
}

export default function Applications() {
  const qc = useQueryClient();
  const [position, setPosition] = useState('');
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const { data: apps = [] } = useQuery({ queryKey: ['applications'], queryFn: listApplications });

  const create = useMutation({
    mutationFn: createApplication,
    onSuccess: () => { setPosition(''); qc.invalidateQueries({ queryKey: ['applications'] }); },
  });

  const move = useMutation({
    mutationFn: ({ id, status }) => updateStatus(id, status),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ['applications'] });
      const prev = qc.getQueryData(['applications']);
      qc.setQueryData(['applications'], (old = []) => old.map((a) => (a.id === id ? { ...a, status } : a)));
      return { prev };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(['applications'], ctx?.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ['applications'] }),
  });

  function onDragEnd(event) {
    applyDrop(
      { activeId: event.active?.id, overId: event.over?.id },
      (id, status) => move.mutate({ id, status }),
    );
  }

  return (
    <div>
      <h1 className="mb-5 text-2xl font-bold text-slate-900">Applications</h1>
      <form
        className="mb-6 flex max-w-md gap-2"
        onSubmit={(e) => { e.preventDefault(); if (position.trim()) create.mutate({ position: position.trim() }); }}
      >
        <input
          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900
            focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          placeholder="Position title"
          value={position}
          onChange={(e) => setPosition(e.target.value)}
        />
        <Button type="submit" disabled={create.isPending}><Plus size={16} aria-hidden="true" /> Add application</Button>
      </form>
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {STATUSES.map((s) => (
            <Column key={s} status={s} apps={apps.filter((a) => a.status === s)} />
          ))}
        </div>
      </DndContext>
    </div>
  );
}
