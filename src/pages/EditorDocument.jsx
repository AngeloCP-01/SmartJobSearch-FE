import { useMemo, useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, Printer, Check, Loader2, TriangleAlert, Save } from 'lucide-react';
import { getAuthoredDocument, updateAuthoredDocument } from '../api/authoredDocuments';
import { useAutosave } from '../hooks/useAutosave';
import DocumentEditor from '../components/DocumentEditor';
import Button from '../components/Button';
import Spinner from '../components/Spinner';

// Child component: only mounts after the parent has loaded the document.
// Because it mounts already-seeded with real data, useAutosave's first-run
// guard catches the mount-time value and skips it — so NO spurious PATCH fires
// on load. Only genuine user edits (title/content state changes) trigger a save.
function EditorDocumentForm({ id, initialDoc }) {
  const [title, setTitle] = useState(initialDoc.title);
  const [content, setContent] = useState(initialDoc.content);

  // `dirty` = there are edits not yet sent to a save. Drives the status text and
  // the Save button, and lets us flush on unmount so leaving never loses edits.
  const [dirty, setDirty] = useState(false);

  const save = useMutation({
    mutationFn: (body) => updateAuthoredDocument(id, body),
    onError: () => setDirty(true), // failed save → still unsaved
  });

  // Memoize so the autosave value keeps a stable reference across re-renders
  // (e.g. save.isPending toggling). A fresh object literal each render would
  // make useAutosave's [value] effect re-run and reschedule the debounce
  // endlessly, looping a save every ~1200ms. Reference only changes on real edits.
  const docValue = useMemo(() => ({ title, content }), [title, content]);

  // Mark dirty on real edits (skip the initial mount value).
  const firstEdit = useRef(true);
  useEffect(() => {
    if (firstEdit.current) { firstEdit.current = false; return; }
    setDirty(true);
  }, [docValue]);

  // Send the document. Clears dirty optimistically (onError re-dirties).
  const flush = (val) => {
    if (val.title.trim() === '') return; // don't persist an invalid empty title
    setDirty(false);
    save.mutate(val);
  };

  // Debounced autosave on edits.
  useAutosave(docValue, flush, 1200);

  // Flush pending edits when leaving the page (Back / unmount) so nothing is lost
  // in the debounce window. Fire-and-forget the API call directly (the component
  // is unmounting, so a mutation hook would be torn down).
  const latest = useRef({ docValue, dirty });
  latest.current = { docValue, dirty };
  useEffect(() => () => {
    const { docValue: v, dirty: d } = latest.current;
    if (d && v.title.trim() !== '') updateAuthoredDocument(id, v).catch(() => {});
  }, [id]);

  const status = save.isError
    ? (<span className="inline-flex items-center gap-1 text-red-600"><TriangleAlert size={14} aria-hidden="true" /> Couldn't save</span>)
    : save.isPending
    ? (<><Loader2 size={14} className="animate-spin" aria-hidden="true" /> Saving…</>)
    : dirty
    ? (<span className="text-amber-600">Unsaved changes</span>)
    : (<><Check size={14} aria-hidden="true" /> Saved</>);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link to="/editor" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft size={16} aria-hidden="true" /> Back
        </Link>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1 text-sm text-slate-500" aria-live="polite">{status}</span>
          <Button onClick={() => flush(docValue)} disabled={save.isPending || !dirty}>
            <Save size={16} aria-hidden="true" /> Save
          </Button>
          <Button variant="subtle" onClick={() => window.print()}>
            <Printer size={16} aria-hidden="true" /> Print / Save as PDF
          </Button>
        </div>
      </div>

      <input
        aria-label="Document title"
        className="mb-4 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xl font-semibold text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Untitled document"
      />

      <DocumentEditor content={content} onChange={setContent} />
    </div>
  );
}

// Route component: owns the query, handles loading/error states, then delegates
// to the form only after the document is available. Does NOT call useAutosave.
export default function EditorDocument() {
  const { id } = useParams();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['authored-document', id],
    queryFn: () => getAuthoredDocument(id),
  });

  if (isLoading) return <Spinner center />;
  if (isError) {
    return (
      <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Couldn't load this document.
      </div>
    );
  }

  if (!data) return null;

  return <EditorDocumentForm id={id} initialDoc={data} />;
}
