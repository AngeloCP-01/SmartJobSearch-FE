// Convert markdown into a ProseMirror/TipTap document so an uploaded .md file
// opens in the editor with real formatting (headings, bold, lists, links).
// marked turns markdown -> HTML, then htmlToProseMirrorDoc does HTML -> JSON.
import { marked } from 'marked';
import { htmlToProseMirrorDoc } from './htmlToProseMirror';

export function markdownToProseMirrorDoc(md) {
  return htmlToProseMirrorDoc(marked.parse(String(md ?? ''), { async: false }));
}
