import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ScanSearch } from 'lucide-react';
import { listApplications } from '../api/applications';
import { listDocuments } from '../api/documents';
import { runAnalysis, listAnalyses, getAnalysis, deleteAnalysis } from '../api/analysis';
import AnalysisReport from '../components/AnalysisReport';
import Button from '../components/Button';

const selectClass = 'rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500';

export default function Analysis() {
  const qc = useQueryClient();
  const [applicationId, setApplicationId] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [current, setCurrent] = useState(null); // {atsScore, matchScore, report}
  const [error, setError] = useState(null);

  const { data: applications = [] } = useQuery({ queryKey: ['applications'], queryFn: listApplications });
  const { data: documents = [] } = useQuery({ queryKey: ['documents'], queryFn: () => listDocuments() });
  const { data: history = [] } = useQuery({ queryKey: ['analyses'], queryFn: listAnalyses });

  const selectedApp = applications.find((a) => a.id === applicationId);
  const noJd = selectedApp && !selectedApp.jobDescription;

  const run = useMutation({
    mutationFn: () => runAnalysis({ applicationId, documentId }),
    onSuccess: (data) => { setCurrent(data); setError(null); qc.invalidateQueries({ queryKey: ['analyses'] }); },
    onError: (e) => setError(e.response?.data?.error?.message || 'Analysis failed'),
  });
  const openHistory = useMutation({
    mutationFn: (id) => getAnalysis(id),
    onSuccess: (data) => setCurrent(data),
  });
  const remove = useMutation({
    mutationFn: (id) => deleteAnalysis(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['analyses'] }),
  });

  function onRun(e) {
    e.preventDefault();
    if (!applicationId || !documentId) { setError('Pick an application and a résumé.'); return; }
    run.mutate();
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-5 text-2xl font-bold text-slate-900">Résumé Analysis</h1>

      <form className="mb-6 rounded-xl border border-sky-100 bg-white p-4 shadow-sm" onSubmit={onRun}>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col text-sm font-medium text-slate-600">
            Application
            <select aria-label="Application" className={`${selectClass} mt-1`} value={applicationId} onChange={(e) => setApplicationId(e.target.value)}>
              <option value="">Select an application…</option>
              {applications.map((a) => <option key={a.id} value={a.id}>{a.position}</option>)}
            </select>
          </label>
          <label className="flex flex-col text-sm font-medium text-slate-600">
            Résumé
            <select aria-label="Résumé" className={`${selectClass} mt-1`} value={documentId} onChange={(e) => setDocumentId(e.target.value)}>
              <option value="">Select a résumé…</option>
              {documents.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <Button type="submit" disabled={run.isPending}><ScanSearch size={16} aria-hidden="true" /> Run analysis</Button>
        </div>
        {noJd && <p className="mt-2 text-xs text-amber-700">This application has no job description — match scoring needs one; the ATS audit will still run.</p>}
        {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
        {run.isPending && <p className="mt-2 text-sm text-slate-500">Analyzing…</p>}
      </form>

      {current && <AnalysisReport report={current.report} atsScore={current.atsScore} matchScore={current.matchScore} />}

      {history.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Past analyses</h2>
          <ul className="space-y-2">
            {history.map((h) => (
              <li key={h.id} className="flex items-center justify-between rounded-lg border border-sky-100 bg-white px-4 py-2 text-sm shadow-sm">
                <button className="text-left hover:underline" onClick={() => openHistory.mutate(h.id)}>
                  <span className="font-medium text-slate-800">{h.documentName}</span>
                  <span className="text-slate-500"> · {h.position || '—'} · ATS {h.atsScore} · Match {h.matchScore ?? 'N/A'}</span>
                </button>
                <button aria-label={`Delete analysis of ${h.documentName}`} className="text-red-600 cursor-pointer"
                  onClick={() => remove.mutate(h.id)}>Delete</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
