import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus, Pencil, Trash2 } from 'lucide-react';
import { listAuthoredDocuments, createAuthoredDocument, deleteAuthoredDocument } from '../api/authoredDocuments';
import Button from '../components/Button';
import Spinner from '../components/Spinner';

const TYPE_LABEL = { Resume: 'Résumé', CoverLetter: 'Cover letter', Note: 'Note' };
const TYPE_STYLE = {
  Resume: 'bg-sky-100 text-sky-700',
  CoverLetter: 'bg-violet-100 text-violet-700',
  Note: 'bg-slate-100 text-slate-600',
};

export default function Editor() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [type, setType] = useState('Resume');
  const [error, setError] = useState(null);

  const { data: docs = [], isLoading, isError } = useQuery({
    queryKey: ['authored-documents'],
    queryFn: listAuthoredDocuments,
  });

  const create = useMutation({
    mutationFn: () => createAuthoredDocument({ title: title.trim() || 'Untitled document', type }),
    onSuccess: (doc) => {
      setTitle(''); setType('Resume'); setError(null);
      qc.invalidateQueries({ queryKey: ['authored-documents'] });
      navigate(`/editor/${doc.id}`);
    },
    onError: (e) => setError(e.response?.data?.error?.message || 'Could not create document'),
  });

  const remove = useMutation({
    mutationFn: deleteAuthoredDocument,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['authored-documents'] }),
    onError: (e) => setError(e.response?.data?.error?.message || 'Could not delete document'),
  });

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-5 text-2xl font-bold text-slate-900">Editor</h1>

      <form
        className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-sky-100 bg-white p-4 shadow-sm"
        onSubmit={(e) => { e.preventDefault(); create.mutate(); }}
      >
        <label className="flex-1 text-sm font-medium text-slate-600">
          New document
          <input
            aria-label="New document title"
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            placeholder="e.g. Backend Engineer Résumé"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="text-sm font-medium text-slate-600">
          Type
          <select
            aria-label="Document type"
            className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {['Resume', 'CoverLetter', 'Note'].map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </select>
        </label>
        <Button type="submit" disabled={create.isPending}>
          <Plus size={16} aria-hidden="true" /> {create.isPending ? 'Creating…' : 'Create document'}
        </Button>
      </form>

      {error && <p role="alert" className="mb-3 text-sm text-red-600">{error}</p>}

      {isLoading && <Spinner center />}
      {isError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Couldn't load documents. Please try again.
        </div>
      )}

      {!isLoading && !isError && (docs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-sky-200 bg-white p-10 text-center text-slate-500">
          <FileText className="mx-auto mb-2 text-slate-300" size={28} aria-hidden="true" />
          No documents yet. Create a résumé, cover letter, or note above.
        </div>
      ) : (
        <ul className="space-y-2">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center justify-between rounded-xl border border-sky-100 bg-white px-4 py-3 shadow-sm">
              <button
                type="button"
                onClick={() => navigate(`/editor/${d.id}`)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <FileText size={18} className="shrink-0 text-slate-400" aria-hidden="true" />
                <span className="truncate font-medium text-slate-900">{d.title}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TYPE_STYLE[d.type]}`}>{TYPE_LABEL[d.type]}</span>
              </button>
              <div className="flex shrink-0 items-center gap-1">
                <Button variant="subtle" aria-label={`Edit ${d.title}`} onClick={() => navigate(`/editor/${d.id}`)}><Pencil size={16} /></Button>
                <Button
                  variant="danger"
                  aria-label={`Delete ${d.title}`}
                  onClick={() => { if (window.confirm(`Delete ${d.title}?`)) remove.mutate(d.id); }}
                ><Trash2 size={16} /></Button>
              </div>
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}
