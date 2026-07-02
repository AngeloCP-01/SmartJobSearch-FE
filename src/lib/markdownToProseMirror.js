// Convert markdown into a ProseMirror/TipTap document so an uploaded .md file
// opens in the editor with real formatting (headings, bold, lists, links).
// marked (markdown -> HTML) + TipTap generateJSON (HTML -> ProseMirror JSON).
// The extension set is a stable subset of the editor's; the resulting node/mark
// types all exist in DocumentEditor, so it loads cleanly (like textToProseMirror).
import { marked } from 'marked';
import { generateJSON } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';

const extensions = [StarterKit, Link, Underline];

export function markdownToProseMirrorDoc(md) {
  const html = marked.parse(String(md ?? ''), { async: false });
  return generateJSON(html, extensions);
}
