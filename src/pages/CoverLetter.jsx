import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { PenLine, Copy, Download, Check, Sparkles, Save, SquarePen } from 'lucide-react';
import { listApplications, getApplication } from '../api/applications';
import { listDocuments, createDocument, linkDocument } from '../api/documents';
import { getAnalysisConfig, generateCoverLetter } from '../api/analysis';
import { createAuthoredDocument } from '../api/authoredDocuments';
import { textToProseMirrorDoc } from '../lib/textToProseMirror';
import Button from '../components/Button';

const selectClass = 'rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500';

function downloadTxt(text, filename) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// "<position> - <company>-cover-letter.txt", stripped of filename-unsafe chars.
// Omits the company when it's missing (or the server's "the company" placeholder).
export function coverLetterFilename(position, company) {
  const clean = (s) => (s || '').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim();
  const co = clean(company);
  const parts = [clean(position), co.toLowerCase() === 'the company' ? '' : co].filter(Boolean);
  return parts.length ? `${parts.join(' - ')}-cover-letter.txt` : 'cover-letter.txt';
}

export default function CoverLetter() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [applicationId, setApplicationId] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [letter, setLetter] = useState('');
  const [meta, setMeta] = useState(null);
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
    mutationFn: () => generateCoverLetter({ applicationId, documentId }),
    onSuccess: (data) => { setLetter(data.coverLetter); setMeta(data.meta); setError(null); setCopied(false); setSaved(false); },
    onError: (e) => setError(e.response?.data?.error?.message || 'Could not generate a cover letter. Please try again.'),
  });

  // Save the (possibly edited) letter as a .txt CoverLetter document, linked to
  // the application so it shows up under that application's Documents too.
  const saveDoc = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append('file', new File([letter], coverLetterFilename(meta?.position, meta?.companyName), { type: 'text/plain' }));
      fd.append('name', `Cover Letter — ${meta?.position || 'Untitled'}`);
      fd.append('type', 'CoverLetter');
      const doc = await createDocument(fd);
      if (applicationId) await linkDocument(applicationId, doc.id);
      return doc;
    },
    onSuccess: () => {
      setSaved(true); setError(null); setTimeout(() => setSaved(false), 2500);
      qc.invalidateQueries({ queryKey: ['documents'] });
      if (applicationId) qc.invalidateQueries({ queryKey: ['application', applicationId] });
    },
    onError: (e) => setError(e.response?.data?.error?.message || 'Could not save the cover letter to Documents.'),
  });

  // Convert the current letter to rich text, create an editable AuthoredDocument
  // (linked to the application), and open it in the TipTap Editor.
  const openInEditor = useMutation({
    mutationFn: () => createAuthoredDocument({
      title: `Cover Letter — ${meta?.position || 'Untitled'}`,
      type: 'CoverLetter',
      content: textToProseMirrorDoc(letter),
      applicationId: applicationId || undefined,
    }),
    onSuccess: (doc) => {
      setError(null);
      qc.invalidateQueries({ queryKey: ['authoredDocuments'] });
      navigate(`/editor/${doc.id}`);
    },
    onError: (e) => setError(e.response?.data?.error?.message || 'Could not open the cover letter in the editor.'),
  });

  function onGenerate(e) {
    e.preventDefault();
    if (!applicationId || !documentId) { setError('Pick an application and a résumé.'); return; }
    generate.mutate();
  }
  async function onCopy() {
    try { await navigator.clipboard.writeText(letter); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-2xl font-bold text-slate-900">Cover Letter Generator</h1>
      <p className="mb-5 inline-flex items-center gap-1.5 text-sm text-slate-500">
        <Sparkles size={15} aria-hidden="true" /> AI-drafted from a job description and your résumé.
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
            <PenLine size={16} aria-hidden="true" /> {generate.isPending ? 'Writing…' : 'Generate'}
          </Button>
        </div>
        {!aiAvailable && <p className="mt-2 text-xs text-slate-400">AI generation is unavailable — set an OpenRouter API key on the server to enable it.</p>}
        {noJd && <p className="mt-2 text-xs text-amber-700">This application has no job description — add one so the letter can be tailored to the role.</p>}
        {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
      </form>

      {letter && (
        <div className="rounded-xl border border-sky-100 bg-white p-4 shadow-sm">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-700">
              {meta ? `${meta.position} · ${meta.companyName}` : 'Cover letter'}
            </h2>
            <div className="flex items-center gap-2">
              <Button type="button" variant="subtle" onClick={onCopy}>
                {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />} {copied ? 'Copied' : 'Copy'}
              </Button>
              <Button type="button" variant="subtle" onClick={() => downloadTxt(letter, coverLetterFilename(meta?.position, meta?.companyName))}>
                <Download size={16} aria-hidden="true" /> .txt
              </Button>
              <Button type="button" variant="subtle" onClick={() => openInEditor.mutate()} loading={openInEditor.isPending}>
                <SquarePen size={16} aria-hidden="true" /> Edit in Editor
              </Button>
              <Button type="button" onClick={() => saveDoc.mutate()} loading={saveDoc.isPending}>
                {saved ? <Check size={16} aria-hidden="true" /> : <Save size={16} aria-hidden="true" />} {saved ? 'Saved' : 'Save to Documents'}
              </Button>
            </div>
          </div>
          <textarea
            aria-label="Cover letter"
            className="h-96 w-full resize-y rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            value={letter}
            onChange={(e) => setLetter(e.target.value)}
          />
          <p className="mt-2 text-xs text-slate-400">
            {meta?.model ? `AI-generated · ${meta.model} · ` : ''}A draft — review and personalize before sending.
          </p>
        </div>
      )}
    </div>
  );
}
