import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Trash2, Maximize2, ExternalLink, Sparkles } from 'lucide-react';
import { listCompanies, createCompany } from '../api/companies';
import { createApplication, updateApplication, deleteApplication, getApplication } from '../api/applications';
import { parsePosting } from '../api/postings';
import { listInterviews, createInterview, updateInterview, deleteInterview } from '../api/interviews';
import { listContacts, linkContact, unlinkContact, createContact } from '../api/contacts';
import { listDocuments, linkDocument, unlinkDocument } from '../api/documents';
import { fetchActivity } from '../api/activity';
import ActivityRow from './ActivityRow';
import { STATUSES } from '../lib/applicationStatus';
import { apiErrorMessage } from '../lib/apiError';
import Field from './Field';
import Button from './Button';

const INTERVIEW_TYPES = ['HR', 'Technical', 'Managerial', 'Final'];
const INTERVIEW_RESULTS = ['Pending', 'Passed', 'Failed'];
const RESULT_STYLES = {
  Passed: 'bg-emerald-100 text-emerald-800',
  Failed: 'bg-red-100 text-red-800',
  Pending: 'bg-amber-100 text-amber-800',
};

const toDateInput = (v) => (v ? new Date(v).toISOString().slice(0, 10) : '');
const num = (v) => (v === '' || v == null ? undefined : Number(v));
const isHttpUrl = (v) => /^https?:\/\/\S+$/i.test((v || '').trim());

function initialForm(app) {
  return {
    position: app?.position || '',
    companyId: app?.companyId ?? app?.company?.id ?? '',
    status: app?.status || 'Draft',
    applicationDate: toDateInput(app?.applicationDate),
    salaryMin: app?.salaryMin ?? '',
    salaryMax: app?.salaryMax ?? '',
    source: app?.source || '',
    workMode: app?.workMode || '',
    jobDescription: app?.jobDescription || '',
    notes: app?.notes || '',
  };
}

const WORK_MODES = [
  { value: 'Remote', label: 'Remote' },
  { value: 'Hybrid', label: 'Hybrid' },
  { value: 'OnSite', label: 'On-site' },
];

const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500';

export default function ApplicationDrawer({ application, open, onClose }) {
  const qc = useQueryClient();
  const isEdit = Boolean(application);
  const [form, setForm] = useState(initialForm(application));
  const [error, setError] = useState(null);
  const [showNewCompany, setShowNewCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [ivType, setIvType] = useState('HR');
  const [ivScheduledAt, setIvScheduledAt] = useState('');
  const [ivInterviewer, setIvInterviewer] = useState('');
  const [selectedContactId, setSelectedContactId] = useState('');
  const [selectedDocumentId, setSelectedDocumentId] = useState('');
  const [showNewContact, setShowNewContact] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [editingDesc, setEditingDesc] = useState(!application?.jobDescription);
  const [descExpanded, setDescExpanded] = useState(false);
  const [paste, setPaste] = useState('');
  const drawerRef = useRef(null);

  useEffect(() => {
    setForm(initialForm(application));
    setError(null);
    setEditingDesc(!application?.jobDescription);
    setDescExpanded(false);
    setPaste('');
  }, [application, open]);

  useEffect(() => {
    if (!descExpanded) return undefined;
    // Capture phase + stopPropagation so Escape closes the modal without also closing the drawer.
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setDescExpanded(false); } };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [descExpanded]);
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
  const { data: interviews = [] } = useQuery({
    queryKey: ['interviews', application?.id],
    queryFn: () => listInterviews(application.id),
    enabled: open && isEdit,
  });
  const { data: detail } = useQuery({
    queryKey: ['application', application?.id],
    queryFn: () => getApplication(application.id),
    enabled: open && isEdit,
  });
  const linkedContacts = detail?.contacts || [];
  const { data: allContacts = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => listContacts(),
    enabled: open && isEdit,
  });
  const linkableContacts = allContacts.filter((c) => !linkedContacts.some((lc) => lc.id === c.id));
  const linkedDocuments = detail?.documents || [];
  const { data: allDocuments = [] } = useQuery({
    queryKey: ['documents'],
    queryFn: () => listDocuments(),
    enabled: open && isEdit,
  });
  const linkableDocuments = allDocuments.filter((d) => !linkedDocuments.some((ld) => ld.id === d.id));
  const { data: activity } = useQuery({
    queryKey: ['activity', application?.id],
    queryFn: () => fetchActivity({ applicationId: application.id }),
    enabled: open && isEdit,
  });
  const activityItems = activity?.items || [];

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  // Apply AI-extracted posting fields onto the form. Only overwrites a field when
  // the parser found a value, so a re-parse never blanks something you typed.
  function applyParsed(d) {
    const co = (d.companyName || '').trim();
    const match = co ? companies.find((c) => c.name.toLowerCase() === co.toLowerCase()) : null;
    setForm((f) => ({
      ...f,
      position: d.position || f.position,
      companyId: match ? match.id : f.companyId,
      salaryMin: d.salaryMin ?? f.salaryMin,
      salaryMax: d.salaryMax ?? f.salaryMax,
      source: d.source || f.source,
      workMode: d.workMode || f.workMode,
      jobDescription: d.jobDescription || f.jobDescription,
    }));
    if (d.jobDescription) setEditingDesc(false); // show it in the formatted read view
    if (co && !match) { setNewCompanyName(co); setShowNewCompany(true); } // prefill inline "new company"
  }

  const parse = useMutation({
    mutationFn: (content) => parsePosting(content),
    onSuccess: (d) => { applyParsed(d); setError(null); },
    // The error is shown inline in the Auto-fill panel (via parse.error), right
    // where the user is looking — not down by the Save button.
  });

  const save = useMutation({
    mutationFn: (body) => (isEdit ? updateApplication(application.id, body) : createApplication(body)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['applications'] }); qc.invalidateQueries({ queryKey: ['activity'] }); onClose(); },
    onError: (e) => setError(apiErrorMessage(e, 'Could not save')),
  });

  const del = useMutation({
    mutationFn: () => deleteApplication(application.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['applications'] }); qc.invalidateQueries({ queryKey: ['activity'] }); onClose(); },
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

  const addInterview = useMutation({
    mutationFn: () => createInterview({ applicationId: application.id, type: ivType, scheduledAt: ivScheduledAt || undefined, interviewer: ivInterviewer || undefined }),
    onSuccess: () => { setIvInterviewer(''); setIvScheduledAt(''); qc.invalidateQueries({ queryKey: ['interviews', application.id] }); qc.invalidateQueries({ queryKey: ['activity'] }); },
    onError: (e) => setError(e.response?.data?.error?.message || 'Could not add interview'),
  });
  const removeInterview = useMutation({
    mutationFn: (id) => deleteInterview(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['interviews', application.id] }),
    onError: (e) => setError(e.response?.data?.error?.message || 'Could not remove interview'),
  });
  const setInterviewResult = useMutation({
    mutationFn: ({ id, result }) => updateInterview(id, { result }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['interviews', application.id] }); qc.invalidateQueries({ queryKey: ['activity'] }); },
    onError: (e) => setError(e.response?.data?.error?.message || 'Could not update interview'),
  });

  const linkContactM = useMutation({
    mutationFn: (contactId) => linkContact(application.id, contactId),
    onSuccess: () => { setSelectedContactId(''); qc.invalidateQueries({ queryKey: ['application', application.id] }); qc.invalidateQueries({ queryKey: ['activity'] }); },
    onError: (e) => setError(e.response?.data?.error?.message || 'Could not link contact'),
  });
  const unlinkContactM = useMutation({
    mutationFn: (contactId) => unlinkContact(application.id, contactId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['application', application.id] }),
    onError: (e) => setError(e.response?.data?.error?.message || 'Could not unlink contact'),
  });
  const quickCreateContactM = useMutation({
    mutationFn: async () => {
      const c = await createContact({ name: newContactName.trim() });
      await linkContact(application.id, c.id);
      return c;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      qc.invalidateQueries({ queryKey: ['application', application.id] });
      qc.invalidateQueries({ queryKey: ['activity'] });
      setNewContactName('');
      setShowNewContact(false);
    },
    onError: (e) => setError(e.response?.data?.error?.message || 'Could not add contact'),
  });
  const linkDocumentM = useMutation({
    mutationFn: (documentId) => linkDocument(application.id, documentId),
    onSuccess: () => { setSelectedDocumentId(''); qc.invalidateQueries({ queryKey: ['application', application.id] }); qc.invalidateQueries({ queryKey: ['activity'] }); },
    onError: (e) => setError(e.response?.data?.error?.message || 'Could not link document'),
  });
  const unlinkDocumentM = useMutation({
    mutationFn: (documentId) => unlinkDocument(application.id, documentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['application', application.id] }),
    onError: (e) => setError(e.response?.data?.error?.message || 'Could not unlink document'),
  });

  function onSubmit(e) {
    e.preventDefault();
    setError(null);
    const min = num(form.salaryMin);
    const max = num(form.salaryMax);
    if (min != null && max != null && min > max) { setError('Min salary must be ≤ max salary'); return; }
    save.mutate({
      position: form.position,
      companyId: form.companyId === '' ? null : form.companyId,
      status: form.status,
      applicationDate: form.applicationDate || undefined,
      salaryMin: min,
      salaryMax: max,
      source: form.source || undefined,
      workMode: form.workMode || null,
      jobDescription: form.jobDescription || undefined,
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
        aria-label={isEdit ? 'Edit application' : 'New application'}
        className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-sky-100 px-5 py-3">
          <h2 className="text-lg font-bold text-slate-900">{isEdit ? 'Application' : 'New application'}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 cursor-pointer">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <form className="px-5 py-4" onSubmit={onSubmit}>
          {!isEdit && (
            <div className="mb-4 rounded-lg border border-sky-100 bg-sky-50/60 p-3">
              <span className="mb-1.5 inline-flex items-center gap-1.5 text-sm font-medium text-sky-800">
                <Sparkles size={15} aria-hidden="true" /> Auto-fill from a posting
              </span>
              <textarea
                aria-label="Job posting"
                className={`${inputClass} text-sm`}
                rows={3}
                placeholder="Paste the job posting text (or a URL) and let AI fill the fields below…"
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
              />
              <div className="mt-2">
                <Button type="button" loading={parse.isPending} disabled={!paste.trim()} onClick={() => parse.mutate(paste.trim())}>
                  <Sparkles size={15} aria-hidden="true" /> {parse.isPending ? 'Reading…' : 'Auto-fill'}
                </Button>
              </div>
              {parse.isError && (
                <p role="alert" className="mt-2 text-sm text-red-700">
                  {apiErrorMessage(parse.error, 'Could not read that posting. Paste the posting text instead.')}
                </p>
              )}
            </div>
          )}

          <Field label="Position" name="position" value={form.position} onChange={set('position')} required />

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

          <label className="block mb-4">
            <span className="block text-sm font-medium text-slate-700 mb-1.5">Status</span>
            <select aria-label="Status" className={inputClass}
              value={form.status} onChange={(e) => set('status')(e.target.value)}>
              {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
          </label>

          <Field label="Applied date" name="applicationDate" type="date" value={form.applicationDate} onChange={set('applicationDate')} />
          <div className="flex gap-3">
            <Field label="Min salary" name="salaryMin" type="number" value={form.salaryMin} onChange={set('salaryMin')} />
            <Field label="Max salary" name="salaryMax" type="number" value={form.salaryMax} onChange={set('salaryMax')} />
          </div>
          <div className="mb-4">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Source</span>
              {isHttpUrl(form.source) && (
                <a href={form.source.trim()} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:underline">
                  Open posting <ExternalLink size={13} aria-hidden="true" />
                </a>
              )}
            </div>
            <input name="source" aria-label="Source" className={inputClass}
              placeholder="https://… link to the job posting"
              value={form.source} onChange={(e) => set('source')(e.target.value)} />
          </div>

          <label className="block mb-4">
            <span className="block text-sm font-medium text-slate-700 mb-1.5">Work mode</span>
            <select aria-label="Work mode" className={inputClass}
              value={form.workMode} onChange={(e) => set('workMode')(e.target.value)}>
              <option value="">Unspecified</option>
              {WORK_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </label>

          <div className="mb-4">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Job description</span>
              <div className="flex items-center gap-3">
                <button type="button" className="text-xs font-medium text-sky-700 hover:underline cursor-pointer"
                  onClick={() => setEditingDesc((s) => !s)}>
                  {editingDesc ? 'Done' : 'Edit'}
                </button>
                {form.jobDescription && (
                  <button type="button" aria-label="Expand job description"
                    className="text-slate-400 hover:text-slate-700 cursor-pointer"
                    onClick={() => setDescExpanded(true)}>
                    <Maximize2 size={15} aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
            {editingDesc ? (
              <textarea name="jobDescription" className={inputClass} rows={12}
                placeholder="Paste the job description here — line breaks and bullets are preserved."
                value={form.jobDescription} onChange={(e) => set('jobDescription')(e.target.value)} />
            ) : form.jobDescription ? (
              <div className="max-h-72 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700">
                {form.jobDescription}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-400">
                No job description yet.{' '}
                <button type="button" className="font-medium text-sky-700 hover:underline cursor-pointer"
                  onClick={() => setEditingDesc(true)}>Add one</button>
              </p>
            )}
          </div>
          <label className="block mb-4">
            <span className="block text-sm font-medium text-slate-700 mb-1.5">Notes</span>
            <textarea name="notes" className={inputClass} rows={3} value={form.notes} onChange={(e) => set('notes')(e.target.value)} />
          </label>

          {error && <p role="alert" className="mb-3 text-sm text-red-600">{error}</p>}

          <div className="flex items-center gap-2">
            <Button type="submit" loading={save.isPending}>Save</Button>
            {isEdit && (
              <Button type="button" variant="danger" loading={del.isPending}
                onClick={() => { if (window.confirm('Delete this application?')) del.mutate(); }}>
                <Trash2 size={16} aria-hidden="true" /> Delete
              </Button>
            )}
          </div>
        </form>

        {isEdit && (
          <div className="border-t border-sky-100 px-5 py-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Interviews</h3>
            <ul className="mb-3 space-y-1">
              {interviews.map((i) => (
                <li key={i.id} className="flex items-center justify-between rounded-lg border border-sky-100 px-3 py-2 text-sm">
                  <span>
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">{i.type}</span>
                    {i.interviewer ? ` · ${i.interviewer}` : ''}
                  </span>
                  <div className="flex items-center gap-2">
                    <select
                      aria-label={`Result for ${i.type}${i.interviewer ? ` with ${i.interviewer}` : ''}`}
                      className={`rounded-full border-0 px-2 py-0.5 text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${RESULT_STYLES[i.result] || 'bg-slate-100 text-slate-600'}`}
                      value={i.result || ''}
                      disabled={setInterviewResult.isPending}
                      onChange={(e) => setInterviewResult.mutate({ id: i.id, result: e.target.value })}
                    >
                      <option value="" disabled>Set result…</option>
                      {INTERVIEW_RESULTS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <button aria-label="Delete interview" className="text-red-600 cursor-pointer" onClick={() => removeInterview.mutate(i.id)}>
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
              {interviews.length === 0 && <li className="text-sm text-slate-400">No interviews yet.</li>}
            </ul>
            <div className="flex flex-wrap gap-2">
              <select aria-label="Add interview type"
                className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                value={ivType} onChange={(e) => setIvType(e.target.value)}>
                {INTERVIEW_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <input aria-label="Add interview scheduled date" type="datetime-local"
                className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                value={ivScheduledAt} onChange={(e) => setIvScheduledAt(e.target.value)} />
              <input aria-label="Add interview interviewer" placeholder="Interviewer"
                className="flex-1 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                value={ivInterviewer} onChange={(e) => setIvInterviewer(e.target.value)} />
              <Button type="button" onClick={() => addInterview.mutate()}>Add interview</Button>
            </div>
          </div>
        )}

        {isEdit && (
          <div className="border-t border-sky-100 px-5 py-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Contacts</h3>
            <ul className="mb-3 space-y-1">
              {linkedContacts.map((c) => (
                <li key={c.id} className="flex items-center justify-between rounded-lg border border-sky-100 px-3 py-2 text-sm">
                  <span>
                    <span className="font-medium text-slate-800">{c.name}</span>
                    {[c.position, c.company?.name].filter(Boolean).length > 0
                      ? ` · ${[c.position, c.company?.name].filter(Boolean).join(' · ')}`
                      : ''}
                  </span>
                  <button aria-label={`Unlink ${c.name}`} className="text-red-600 cursor-pointer" onClick={() => unlinkContactM.mutate(c.id)}>
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </li>
              ))}
              {linkedContacts.length === 0 && <li className="text-sm text-slate-400">No contacts linked yet.</li>}
            </ul>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Link an existing contact</span>
              <button type="button" className="text-xs font-medium text-sky-700 hover:underline cursor-pointer"
                onClick={() => setShowNewContact((s) => !s)}>
                {showNewContact ? 'Cancel' : 'New contact'}
              </button>
            </div>
            {showNewContact ? (
              <div className="flex gap-2">
                <input aria-label="New contact name" placeholder="Contact name"
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  value={newContactName} onChange={(e) => setNewContactName(e.target.value)} />
                <Button type="button" onClick={() => newContactName.trim() && quickCreateContactM.mutate()}>Create &amp; link</Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <select aria-label="Link a contact"
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  value={selectedContactId} onChange={(e) => setSelectedContactId(e.target.value)}>
                  <option value="">Select a contact…</option>
                  {linkableContacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <Button type="button" disabled={!selectedContactId} onClick={() => selectedContactId && linkContactM.mutate(selectedContactId)}>Link</Button>
              </div>
            )}
          </div>
        )}

        {isEdit && (
          <div className="border-t border-sky-100 px-5 py-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Documents</h3>
            <ul className="mb-3 space-y-1">
              {linkedDocuments.map((d) => (
                <li key={d.id} className="flex items-center justify-between rounded-lg border border-sky-100 px-3 py-2 text-sm">
                  <span>
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">{d.type}</span>
                    {' '}
                    <span className="font-medium text-slate-800">{d.name}</span>
                  </span>
                  <button aria-label={`Unlink ${d.name}`} className="text-red-600 cursor-pointer" onClick={() => unlinkDocumentM.mutate(d.id)}>
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </li>
              ))}
              {linkedDocuments.length === 0 && <li className="text-sm text-slate-400">No documents linked yet.</li>}
            </ul>
            <div className="flex gap-2">
              <select aria-label="Link a document"
                className="flex-1 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                value={selectedDocumentId} onChange={(e) => setSelectedDocumentId(e.target.value)}>
                <option value="">Select a document…</option>
                {linkableDocuments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <Button type="button" disabled={!selectedDocumentId} onClick={() => selectedDocumentId && linkDocumentM.mutate(selectedDocumentId)}>Link document</Button>
            </div>
          </div>
        )}

        {isEdit && (
          <div className="border-t border-sky-100 px-5 py-4">
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Activity</h3>
            {activityItems.length === 0 ? (
              <p className="text-sm text-slate-400">No activity yet.</p>
            ) : (
              <ul>{activityItems.map((item) => <ActivityRow key={item.id} item={item} />)}</ul>
            )}
          </div>
        )}
      </aside>

      {descExpanded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog" aria-modal="true" aria-label="Job description">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setDescExpanded(false)} aria-hidden="true" />
          <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="text-base font-semibold text-slate-900">{form.position || 'Job description'}</h3>
              <button onClick={() => setDescExpanded(false)} aria-label="Close job description"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 cursor-pointer">
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="overflow-y-auto whitespace-pre-wrap break-words px-6 py-5 text-[15px] leading-7 text-slate-700">
              {form.jobDescription}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
