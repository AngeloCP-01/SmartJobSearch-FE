import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Trash2 } from 'lucide-react';
import { listCompanies, createCompany } from '../api/companies';
import { createContact, updateContact, deleteContact } from '../api/contacts';
import Field from './Field';
import Button from './Button';

const toDateInput = (v) => (v ? new Date(v).toISOString().slice(0, 10) : '');
const isValidEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const isValidUrl = (s) => { try { return Boolean(new URL(s)); } catch { return false; } };

const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500';

function initialForm(contact) {
  return {
    name: contact?.name || '',
    email: contact?.email || '',
    position: contact?.position || '',
    phone: contact?.phone || '',
    linkedinUrl: contact?.linkedinUrl || '',
    companyId: contact?.companyId ?? contact?.company?.id ?? '',
    followUpDate: toDateInput(contact?.followUpDate),
    notes: contact?.notes || '',
  };
}

export default function ContactDrawer({ contact, open, onClose }) {
  const qc = useQueryClient();
  const isEdit = Boolean(contact);
  const [form, setForm] = useState(initialForm(contact));
  const [error, setError] = useState(null);
  const [showNewCompany, setShowNewCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const drawerRef = useRef(null);

  useEffect(() => { setForm(initialForm(contact)); setError(null); }, [contact, open]);
  useEffect(() => {
    if (!open) return undefined;
    const node = drawerRef.current;
    const getFocusable = () => Array.from(
      node?.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) || [],
    );
    const onKey = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const els = getFocusable();
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    node?.addEventListener('keydown', onKey);
    getFocusable()[0]?.focus();
    return () => node?.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: () => listCompanies(), enabled: open });
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: (body) => (isEdit ? updateContact(contact.id, body) : createContact(body)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contacts'] }); onClose(); },
    onError: (e) => setError(e.response?.data?.error?.message || 'Could not save'),
  });
  const del = useMutation({
    mutationFn: () => deleteContact(contact.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contacts'] }); onClose(); },
    onError: (e) => setError(e.response?.data?.error?.message || 'Could not delete'),
  });
  const addCompany = useMutation({
    mutationFn: () => createCompany({ name: newCompanyName.trim() }),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ['companies'] });
      setForm((f) => ({ ...f, companyId: c.id }));
      setNewCompanyName('');
      setShowNewCompany(false);
    },
    onError: (e) => setError(e.response?.data?.error?.message || 'Could not create company'),
  });

  function onSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) { setError('Name is required'); return; }
    if (form.email && !isValidEmail(form.email)) { setError('Enter a valid email address'); return; }
    if (form.linkedinUrl && !isValidUrl(form.linkedinUrl)) { setError('Enter a valid URL'); return; }
    save.mutate({
      name: form.name.trim(),
      email: form.email || undefined,
      position: form.position || undefined,
      phone: form.phone || undefined,
      linkedinUrl: form.linkedinUrl || undefined,
      companyId: form.companyId === '' ? null : form.companyId,
      followUpDate: form.followUpDate || undefined,
      notes: form.notes || undefined,
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} aria-hidden="true" />
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'Edit contact' : 'New contact'}
        className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-sky-100 px-5 py-3">
          <h2 className="text-lg font-bold text-slate-900">{isEdit ? 'Contact' : 'New contact'}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 cursor-pointer">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <form className="px-5 py-4" onSubmit={onSubmit} noValidate>
          <Field label="Name" name="name" value={form.name} onChange={set('name')} required />
          <Field label="Email" name="email" type="email" value={form.email} onChange={set('email')} />
          <Field label="Position" name="position" value={form.position} onChange={set('position')} />
          <Field label="Phone" name="phone" value={form.phone} onChange={set('phone')} />
          <Field label="LinkedIn URL" name="linkedinUrl" value={form.linkedinUrl} onChange={set('linkedinUrl')} />

          <div className="mb-4">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Company</span>
              <button type="button" className="text-xs font-medium text-sky-700 hover:underline cursor-pointer"
                onClick={() => setShowNewCompany((s) => !s)}>
                {showNewCompany ? 'Cancel' : 'New company'}
              </button>
            </div>
            <select aria-label="Company" className={inputClass}
              value={form.companyId} onChange={(e) => set('companyId')(e.target.value)}>
              <option value="">No company</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {showNewCompany && (
              <div className="mt-2 flex gap-2">
                <input aria-label="New company name" placeholder="Company name"
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  value={newCompanyName} onChange={(e) => setNewCompanyName(e.target.value)} />
                <Button type="button" onClick={() => newCompanyName.trim() && addCompany.mutate()}>Add</Button>
              </div>
            )}
          </div>

          <Field label="Follow-up date" name="followUpDate" type="date" value={form.followUpDate} onChange={set('followUpDate')} />

          <label className="block mb-4">
            <span className="block text-sm font-medium text-slate-700 mb-1.5">Notes</span>
            <textarea name="notes" className={inputClass} rows={3} value={form.notes} onChange={(e) => set('notes')(e.target.value)} />
          </label>

          {error && <p role="alert" className="mb-3 text-sm text-red-600">{error}</p>}

          <div className="flex items-center gap-2">
            <Button type="submit" disabled={save.isPending}>Save</Button>
            {isEdit && (
              <Button type="button" variant="danger" disabled={del.isPending}
                onClick={() => { if (window.confirm('Delete this contact?')) del.mutate(); }}>
                <Trash2 size={16} aria-hidden="true" /> Delete
              </Button>
            )}
          </div>
        </form>
      </aside>
    </div>
  );
}
