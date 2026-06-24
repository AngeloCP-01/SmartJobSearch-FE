import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { updateDocument } from '../api/documents';
import Button from '../components/Button';

const TYPES = ['Resume', 'CoverLetter', 'Other'];
const TYPE_LABEL = { Resume: 'Resume', CoverLetter: 'Cover Letter', Other: 'Other' };
const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500';

export default function DocumentDrawer({ open, document, onClose }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [type, setType] = useState('Resume');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (document) { setName(document.name || ''); setType(document.type || 'Resume'); setNotes(document.notes || ''); setError(null); }
  }, [document]);

  const save = useMutation({
    mutationFn: () => updateDocument(document.id, { name, type, notes: notes || null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['documents'] }); onClose(); },
    onError: (e) => setError(e.response?.data?.error?.message || 'Could not save'),
  });

  if (!open || !document) return null;

  return (
    <div className="fixed inset-0 z-30 flex justify-end bg-slate-900/30" onClick={onClose}>
      <aside
        role="dialog"
        aria-label="Edit document"
        className="h-full w-full max-w-md overflow-y-auto bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-sky-100 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Edit document</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 cursor-pointer">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <form className="px-5 py-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <label className="mb-3 block text-sm font-medium text-slate-600">
            Name
            <input aria-label="Name" className={`${inputClass} mt-1`} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="mb-3 block text-sm font-medium text-slate-600">
            Type
            <select aria-label="Type" className={`${inputClass} mt-1`} value={type} onChange={(e) => setType(e.target.value)}>
              {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
          </label>
          <label className="mb-4 block text-sm font-medium text-slate-600">
            Notes
            <textarea aria-label="Notes" rows={3} className={`${inputClass} mt-1`} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          {error && <p role="alert" className="mb-3 text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={save.isPending}>Save</Button>
        </form>
      </aside>
    </div>
  );
}
