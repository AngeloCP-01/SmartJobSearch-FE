import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Wand2, Copy, Check, Save, Sparkles, SquarePen } from 'lucide-react';
import { listApplications, getApplication } from '../api/applications';
import { listDocuments, createDocument, linkDocument } from '../api/documents';
import { getAnalysisConfig, tailorResume } from '../api/analysis';
import { fetchEditorContent } from '../lib/openDocumentInEditor';
import { createAuthoredDocument } from '../api/authoredDocuments';
import Button from '../components/Button';

const selectClass = 'rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500';

const dot = { high: 'bg-red-500', medium: 'bg-amber-500', low: 'bg-slate-400' };
const kindLabel = { add: 'Add', emphasize: 'Emphasize', rephrase: 'Rephrase', remove: 'Remove' };

// Format suggestions as plain text for Copy / Save-to-Documents.
export function suggestionsToText(suggestions, meta) {
  const header = `Tailoring notes — ${meta?.position || 'Untitled'}${meta?.companyName && meta.companyName !== 'the company' ? ` @ ${meta.companyName}` : ''}`;
  const lines = suggestions.map((s, i) =>
    `${i + 1}. [${kindLabel[s.kind]}] ${s.text}\n   Why: ${s.why}\n   Grounded in: ${s.groundedIn}`);
  return `${header}\n\n${lines.join('\n\n')}\n`;
}

function notesFilename(position) {
  const clean = (position || 'Untitled').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim();
  return `Tailoring Notes — ${clean}.txt`;
}

export default function TailorResume() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [applicationId, setApplicationId] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [suggestions, setSuggestions] = useState(null);
  const [meta, setMeta] = useState(null);
  const [checked, setChecked] = useState({});
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data: applications = [] } = useQuery({ queryKey: ['applications'], queryFn: listApplications });
  const { data: documents = [] } = useQuery({ queryKey: ['documents'], queryFn: () => listDocuments() });
  const { data: aiConfig } = useQuery({ queryKey: ['analysisConfig'], queryFn: getAnalysisConfig });
  const aiAvailable = Boolean(aiConfig?.aiAvailable);
  const { data: appDetail } = useQuery({
    queryKey: ['application', applicationId],
    queryFn: () => getApplication(applicationId),
    enabled: Boolean(applicationId),
  });
  const noJd = Boolean(appDetail) && !appDetail.jobDescription;

  const generate = useMutation({
    mutationFn: () => tailorResume({ applicationId, documentId }),
    onSuccess: (data) => {
      setSuggestions(data.suggestions); setMeta(data.meta); setChecked({});
      setError(null); setCopied(false); setSaved(false);
    },
    onError: (e) => setError(e.response?.data?.error?.message || 'Could not generate tailoring suggestions. Please try again.'),
  });

  const saveDoc = useMutation({
    mutationFn: async () => {
      const text = suggestionsToText(suggestions, meta);
      const fd = new FormData();
      fd.append('file', new File([text], notesFilename(meta?.position), { type: 'text/plain' }));
      fd.append('name', `Tailoring Notes — ${meta?.position || 'Untitled'}`);
      fd.append('type', 'Other');
      const doc = await createDocument(fd);
      if (applicationId) await linkDocument(applicationId, doc.id);
      return doc;
    },
    onSuccess: () => {
      setSaved(true); setError(null); setTimeout(() => setSaved(false), 2500);
      qc.invalidateQueries({ queryKey: ['documents'] });
      if (applicationId) qc.invalidateQueries({ queryKey: ['application', applicationId] });
    },
    onError: (e) => setError(e.response?.data?.error?.message || 'Could not save the notes to Documents.'),
  });

  const draft = useMutation({
    mutationFn: async () => {
      const doc = documents.find((d) => d.id === documentId);
      const { ok, content } = await fetchEditorContent(documentId, doc?.originalFilename);
      if (!ok) {
        const e = new Error('no-text');
        e.friendly = 'No selectable text found in this résumé (it may be scanned or image-only).';
        throw e;
      }
      return createAuthoredDocument({
        title: `Tailored Résumé — ${meta?.position || 'Untitled'}`,
        type: 'Resume',
        content,
        applicationId: applicationId || undefined,
      });
    },
    onSuccess: (created) => {
      setError(null);
      navigate(`/editor/${created.id}`, { state: { tailoring: { suggestions, meta } } });
    },
    onError: (e) => setError(e.friendly || 'Could not open the résumé in the editor.'),
  });

  function onGenerate(e) {
    e.preventDefault();
    if (!applicationId || !documentId) { setError('Pick an application and a résumé.'); return; }
    generate.mutate();
  }
  async function onCopy() {
    try {
      await navigator.clipboard.writeText(suggestionsToText(suggestions, meta));
      setCopied(true); setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-2xl font-bold text-slate-900">Tailor Résumé</h1>
      <p className="mb-5 inline-flex items-center gap-1.5 text-sm text-slate-500">
        <Sparkles size={15} aria-hidden="true" /> AI suggestions grounded in your real documents — nothing invented.
      </p>

      <form className="mb-6 rounded-xl border border-sky-100 bg-white p-4 shadow-sm" onSubmit={onGenerate}>
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
          <Button type="submit" loading={generate.isPending} disabled={!aiAvailable}>
            <Wand2 size={16} aria-hidden="true" /> {generate.isPending ? 'Tailoring…' : 'Tailor'}
          </Button>
        </div>
        {!aiAvailable && <p className="mt-2 text-xs text-slate-400">AI is unavailable — set an OpenRouter API key on the server to enable it.</p>}
        {noJd && <p className="mt-2 text-xs text-amber-700">This application has no job description — add one so suggestions can be tailored to the role.</p>}
        {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
      </form>

      {suggestions && (
        <div className="rounded-xl border border-sky-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-700">
              {meta ? `${meta.position} · ${meta.companyName}` : 'Suggestions'}
            </h2>
            <div className="flex items-center gap-2">
              <Button type="button" variant="subtle" onClick={onCopy}>
                {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />} {copied ? 'Copied' : 'Copy all'}
              </Button>
              <Button type="button" onClick={() => saveDoc.mutate()} loading={saveDoc.isPending}>
                {saved ? <Check size={16} aria-hidden="true" /> : <Save size={16} aria-hidden="true" />} {saved ? 'Saved' : 'Save to Documents'}
              </Button>
              <Button type="button" onClick={() => draft.mutate()} loading={draft.isPending} disabled={suggestions.length === 0}>
                <SquarePen size={16} aria-hidden="true" /> Draft in Editor
              </Button>
            </div>
          </div>

          {suggestions.length === 0 ? (
            <p className="text-sm text-slate-500">No changes suggested — this résumé already fits the role well.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {suggestions.map((s, i) => (
                <li key={i} className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <input
                    type="checkbox"
                    aria-label={`Done: ${s.text}`}
                    className="mt-1 h-4 w-4 shrink-0"
                    checked={Boolean(checked[i])}
                    onChange={() => setChecked((c) => ({ ...c, [i]: !c[i] }))}
                  />
                  <div className={checked[i] ? 'opacity-50' : ''}>
                    <div className="mb-0.5 flex items-center gap-2">
                      <span className={`inline-block h-2 w-2 rounded-full ${dot[s.severity]}`} aria-hidden="true" />
                      <span className="rounded bg-sky-100 px-1.5 py-0.5 text-xs font-medium text-sky-800">{kindLabel[s.kind]}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-800">{s.text}</p>
                    <p className="text-xs text-slate-500">{s.why}</p>
                    <p className="mt-0.5 text-xs italic text-slate-400">Grounded in {s.groundedIn}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-slate-400">
            {meta?.model ? `AI-generated · ${meta.model} · ` : ''}Suggestions only — you decide what to apply.
          </p>
        </div>
      )}
    </div>
  );
}
