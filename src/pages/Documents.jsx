import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Upload, Trash2, Download, Pencil, FileText } from 'lucide-react';
import { listDocuments, createDocument, deleteDocument, downloadDocument } from '../api/documents';
import DocumentDrawer from '../components/DocumentDrawer';
import Button from '../components/Button';

const TYPES = ['Resume', 'CoverLetter', 'Other'];
const TYPE_LABEL = { Resume: 'Resume', CoverLetter: 'Cover Letter', Other: 'Other' };
const TYPE_STYLE = {
  Resume: 'bg-sky-100 text-sky-800',
  CoverLetter: 'bg-emerald-100 text-emerald-800',
  Other: 'bg-slate-100 text-slate-600',
};
const fmtSize = (b) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  // Defer the revoke: revoking synchronously can invalidate the URL before the
  // browser has finished reading the blob, producing an empty/failed download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

const inputClass = 'rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500';

export default function Documents() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [file, setFile] = useState(null);
  const [name, setName] = useState('');
  const [type, setType] = useState('Resume');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);

  const { data: docs = [], isLoading, isError } = useQuery({
    queryKey: ['documents', search],
    queryFn: () => listDocuments(search),
  });

  const upload = useMutation({
    mutationFn: (formData) => createDocument(formData),
    onSuccess: () => {
      setFile(null); setName(''); setNotes(''); setType('Resume'); setError(null);
      qc.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: (e) => setError(e.response?.data?.error?.message || 'Upload failed'),
  });
  const remove = useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });

  function onSubmit(e) {
    e.preventDefault();
    if (!file || !name.trim()) { setError('A file and a name are required'); return; }
    const fd = new FormData();
    fd.append('file', file);
    fd.append('name', name.trim());
    fd.append('type', type);
    if (notes.trim()) fd.append('notes', notes.trim());
    upload.mutate(fd);
  }

  function onDownload(doc) {
    setError(null);
    downloadDocument(doc.id)
      .then((blob) => saveBlob(blob, doc.originalFilename))
      .catch(() => setError(`Could not download ${doc.name}. Please try again.`));
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-5 text-2xl font-bold text-slate-900">Documents</h1>

      <form className="mb-6 rounded-xl border border-sky-100 bg-white p-4 shadow-sm" onSubmit={onSubmit}>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col text-sm font-medium text-slate-600">
            File
            <input
              aria-label="File"
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="mt-1 text-sm"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>
          <input aria-label="Document name" className={`${inputClass} flex-1 min-w-40`} placeholder="Name (e.g. Backend Resume v2)"
            value={name} onChange={(e) => setName(e.target.value)} />
          <select aria-label="Document type" className={inputClass} value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </select>
          <Button type="submit" disabled={upload.isPending}><Upload size={16} aria-hidden="true" /> Upload</Button>
        </div>
        <input aria-label="Document notes" className={`${inputClass} mt-3 w-full`} placeholder="Notes (optional)"
          value={notes} onChange={(e) => setNotes(e.target.value)} />
        {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
      </form>

      <div className="relative mb-4">
        <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input className={`${inputClass} w-full pl-10`} placeholder="Search documents…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {isLoading && <p className="text-slate-500">Loading…</p>}

      {isError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Couldn’t load documents. Please try again.
        </div>
      )}

      {!isLoading && !isError && (docs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-sky-200 bg-white p-10 text-center text-slate-500">
          <FileText className="mx-auto mb-2 text-slate-300" size={28} aria-hidden="true" />
          No documents yet. Upload a résumé or cover letter above.
        </div>
      ) : (
        <ul className="space-y-2">
          {docs.map((d) => (
            <li key={d.id} className="flex items-start justify-between rounded-xl border border-sky-100 bg-white px-4 py-3 shadow-sm">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-slate-900">{d.name}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TYPE_STYLE[d.type] || TYPE_STYLE.Other}`}>{TYPE_LABEL[d.type] || d.type}</span>
                </div>
                <p className="text-sm text-slate-500">{[d.originalFilename, fmtSize(d.sizeBytes)].filter(Boolean).join(' · ')}</p>
                {d.notes && <p className="mt-0.5 text-sm text-slate-500">{d.notes}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button variant="subtle" aria-label={`Download ${d.name}`} onClick={() => onDownload(d)}>
                  <Download size={16} aria-hidden="true" />
                </Button>
                <Button variant="subtle" aria-label={`Edit ${d.name}`} onClick={() => setEditing(d)}>
                  <Pencil size={16} aria-hidden="true" />
                </Button>
                <Button variant="danger" aria-label={`Delete ${d.name}`}
                  onClick={() => { if (window.confirm(`Delete ${d.name}?`)) remove.mutate(d.id); }}>
                  <Trash2 size={16} aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ))}

      <DocumentDrawer open={Boolean(editing)} document={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
