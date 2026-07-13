import { getDocumentText } from '../api/documents';
import { textToProseMirrorDoc } from './textToProseMirror';
import { markdownToProseMirrorDoc } from './markdownToProseMirror';
import { htmlToProseMirrorDoc } from './htmlToProseMirror';

const extOf = (filename) => (String(filename).match(/\.([^.]+)$/)?.[1] || '').toLowerCase();

// Fetch an uploaded document's text and convert it to a ProseMirror/TipTap doc
// for the editor. DOCX returns as HTML (formatting preserved), .md as raw
// markdown, PDF/plain as raw text. Returns { ok: false } when the file has no
// selectable text (scanned / image-only) so callers never open an empty draft.
export async function fetchEditorContent(documentId, filename) {
  const { ok, kind, content: raw } = await getDocumentText(documentId);
  if (!ok) return { ok: false };
  let content;
  if (kind === 'html') content = htmlToProseMirrorDoc(raw);
  else if (extOf(filename) === 'md') content = markdownToProseMirrorDoc(raw);
  else content = textToProseMirrorDoc(raw);
  return { ok: true, content };
}
