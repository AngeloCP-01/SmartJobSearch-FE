// Convert plain text (e.g. a generated cover letter) into a ProseMirror/TipTap
// document: one paragraph per line, blank lines as empty paragraphs. Feeds
// DocumentEditor directly (no images, so no migration needed).
export function textToProseMirrorDoc(text) {
  const content = String(text ?? '')
    .split('\n')
    .map((line) =>
      line ? { type: 'paragraph', content: [{ type: 'text', text: line }] } : { type: 'paragraph' },
    );
  return { type: 'doc', content };
}
