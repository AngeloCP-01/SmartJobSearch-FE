import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search, Upload, Trash2, Download, Pencil, FileText, X, FilePenLine } from 'lucide-react';
import { listDocuments, createDocument, deleteDocument, downloadDocument } from '../api/documents';
import { fetchEditorContent } from '../lib/openDocumentInEditor';
import { createAuthoredDocument } from '../api/authoredDocuments';
import DocumentDrawer from '../components/DocumentDrawer';
import Button from '../components/Button';
import Spinner from '../components/Spinner';

const TYPES = ['Resume', 'CoverLetter', 'Other'];
const TYPE_LABEL = { Resume: 'Resume', CoverLetter: 'Cover Letter', Other: 'Other' };
const TYPE_STYLE = {
  Resume: 'bg-sky-100 text-sky-800',
  CoverLetter: 'bg-emerald-100 text-emerald-800',
  Other: 'bg-slate-100 text-slate-600',
};
const fmtSize = (b) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const OPENABLE = new Set(['pdf', 'docx', 'md']);
const extOf = (filename) => (String(filename).match(/\.([^.]+)$/)?.[1] || '').toLowerCase();
const AUTHORED_TYPE = { Resume: 'Resume', CoverLetter: 'CoverLetter', Other: 'Note' };

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
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const [openingId, setOpeningId] = useState(null);

  function pickFile(f) {
    if (!f) return;
    setFile(f);
    setError(null);
    // Prefill the name from the filename (minus extension) when it's still empty,
    // so a file alone is usually enough to upload.
    if (!name.trim()) setName(f.name.replace(/\.[^./\\]+$/, ''));
  }
  function clearFile() {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const { data: docs = [], isLoading, isError } = useQuery({
    queryKey: ['documents', search],
    queryFn: () => listDocuments(search),
  });

  const upload = useMutation({
    mutationFn: (formData) => createDocument(formData),
    onSuccess: () => {
      clearFile(); setName(''); setNotes(''); setType('Resume'); setError(null);
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

  async function onOpenInEditor(doc) {
    setError(null);
    setOpeningId(doc.id);
    try {
      const { ok, content } = await fetchEditorContent(doc.id, doc.originalFilename);
      if (!ok) {
        setError('No selectable text found — this file may be scanned or image-only.');
        return;
      }
      const created = await createAuthoredDocument({
        title: doc.name,
        type: AUTHORED_TYPE[doc.type] || 'Note',
        content,
      });
      navigate(`/editor/${created.id}`);
    } catch {
      setError("Couldn't open in editor. Please try again.");
    } finally {
      setOpeningId(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-5 text-2xl font-bold text-slate-900">Documents</h1>

      <form className="mb-6 rounded-xl border border-sky-100 bg-white p-4 shadow-sm" onSubmit={onSubmit}>
        <span className="mb-1.5 block text-sm font-medium text-slate-600">File</span>
        <input
          ref={fileInputRef}
          aria-label="File"
          type="file"
          accept=".pdf,.doc,.docx,.md,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/markdown"
          className="sr-only"
          onChange={(e) => pickFile(e.target.files?.[0])}
        />
        <div
          role="button"
          tabIndex={0}
          aria-label="Choose file"
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files?.[0]); }}
          className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed px-4 py-3 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500
            ${dragOver ? 'border-sky-400 bg-sky-50' : file ? 'border-sky-200 bg-sky-50/50' : 'border-slate-300 hover:border-sky-300 hover:bg-slate-50'}`}
        >
          {file ? (
            <>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-sky-100 text-sky-700">
                <FileText size={18} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-slate-800">{file.name}</span>
                <span className="block text-xs text-slate-500">{fmtSize(file.size)} · click to replace</span>
              </span>
              <button
                type="button"
                aria-label="Remove file"
                onClick={(e) => { e.stopPropagation(); clearFile(); }}
                className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-red-600 cursor-pointer"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </>
          ) : (
            <>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
                <Upload size={18} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-slate-700">Click to choose a file or drag it here</span>
                <span className="block text-xs text-slate-500">PDF, DOC, DOCX, or Markdown · up to 5 MB</span>
              </span>
            </>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input aria-label="Document name" className={`${inputClass} flex-1 min-w-40`} placeholder="Name (e.g. Backend Resume v2)"
            value={name} onChange={(e) => setName(e.target.value)} />
          <select aria-label="Document type" className={inputClass} value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </select>
        </div>
        <input aria-label="Document notes" className={`${inputClass} mt-3 w-full`} placeholder="Notes (optional)"
          value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div className="mt-3 flex items-center gap-3">
          <Button type="submit" disabled={upload.isPending}>
            <Upload size={16} aria-hidden="true" /> {upload.isPending ? 'Uploading…' : 'Upload'}
          </Button>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        </div>
      </form>

      <div className="relative mb-4">
        <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input className={`${inputClass} w-full pl-10`} placeholder="Search documents…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {isLoading && <Spinner center />}

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
                {OPENABLE.has(extOf(d.originalFilename)) && (
                  <Button variant="subtle" aria-label={`Open ${d.name} in editor`}
                    disabled={openingId === d.id} onClick={() => onOpenInEditor(d)}>
                    <FilePenLine size={16} aria-hidden="true" />
                  </Button>
                )}
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
