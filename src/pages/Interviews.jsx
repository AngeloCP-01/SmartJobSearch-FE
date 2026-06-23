import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, CalendarClock } from 'lucide-react';
import { listInterviews, createInterview, deleteInterview } from '../api/interviews';
import { listApplications } from '../api/applications';
import Button from '../components/Button';

const TYPES = ['HR', 'Technical', 'Managerial', 'Final'];

const RESULT_STYLES = {
  Passed: 'bg-emerald-100 text-emerald-800',
  Failed: 'bg-red-100 text-red-800',
  Pending: 'bg-amber-100 text-amber-800',
};

const selectClass = 'rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500';

export default function Interviews() {
  const qc = useQueryClient();
  const [applicationId, setApplicationId] = useState('');
  const [type, setType] = useState('HR');
  const [interviewer, setInterviewer] = useState('');

  const { data: interviews = [] } = useQuery({ queryKey: ['interviews'], queryFn: listInterviews });
  const { data: applications = [] } = useQuery({ queryKey: ['applications'], queryFn: listApplications });

  const positionFor = (id) => applications.find((a) => a.id === id)?.position;

  const create = useMutation({
    mutationFn: createInterview,
    onSuccess: () => { setInterviewer(''); qc.invalidateQueries({ queryKey: ['interviews'] }); },
  });
  const remove = useMutation({
    mutationFn: deleteInterview,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['interviews'] }),
  });

  function onSubmit(e) {
    e.preventDefault();
    if (!applicationId) return;
    create.mutate({ applicationId, type, interviewer: interviewer || undefined });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-5 text-2xl font-bold text-slate-900">Interviews</h1>

      <form className="mb-6 flex flex-wrap gap-2" onSubmit={onSubmit}>
        <select className={selectClass} aria-label="Application" value={applicationId} onChange={(e) => setApplicationId(e.target.value)}>
          <option value="">Select application…</option>
          {applications.map((a) => <option key={a.id} value={a.id}>{a.position}</option>)}
        </select>
        <select className={selectClass} aria-label="Interview type" value={type} onChange={(e) => setType(e.target.value)}>
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input
          className="flex-1 min-w-40 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          placeholder="Interviewer (optional)"
          value={interviewer}
          onChange={(e) => setInterviewer(e.target.value)}
        />
        <Button type="submit" disabled={create.isPending}><Plus size={16} aria-hidden="true" /> Add interview</Button>
      </form>

      {interviews.length === 0 ? (
        <div className="rounded-xl border border-dashed border-sky-200 bg-white p-10 text-center text-slate-500">
          <CalendarClock className="mx-auto mb-2 text-slate-300" size={28} aria-hidden="true" />
          No interviews scheduled yet.
        </div>
      ) : (
        <ul className="divide-y divide-sky-100 overflow-hidden rounded-xl border border-sky-100 bg-white">
          {interviews.map((i) => (
            <li key={i.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-800">{i.type}</span>
                <div>
                  <p className="font-medium text-slate-900">{positionFor(i.applicationId) || 'Application'}</p>
                  <p className="text-sm text-slate-500">
                    {i.interviewer || 'Interviewer TBD'}
                    {i.scheduledAt ? ` · ${new Date(i.scheduledAt).toLocaleDateString()}` : ''}
                  </p>
                </div>
                {i.result && (
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${RESULT_STYLES[i.result] || 'bg-slate-100 text-slate-600'}`}>{i.result}</span>
                )}
              </div>
              <Button variant="danger" aria-label="Delete interview" onClick={() => remove.mutate(i.id)}>
                <Trash2 size={16} aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
