// Convert an HTML fragment into a ProseMirror/TipTap document. Used when an
// uploaded DOCX is extracted to HTML (mammoth) so it opens in the editor with
// its formatting — headings, bold, lists — instead of a flat wall of text.
// The extension set is a stable subset of the editor's; the resulting node/mark
// types all exist in DocumentEditor, so it loads cleanly.
import { generateJSON } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';

const extensions = [StarterKit, Link, Underline];

export function htmlToProseMirrorDoc(html) {
  return generateJSON(String(html ?? ''), extensions);
}
