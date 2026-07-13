import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchEditorContent } from './openDocumentInEditor';
import { getDocumentText } from '../api/documents';

vi.mock('../api/documents', () => ({ getDocumentText: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

describe('fetchEditorContent', () => {
  it('converts DOCX html to a ProseMirror doc', async () => {
    getDocumentText.mockResolvedValue({ ok: true, kind: 'html', content: '<p>Hi</p>' });
    const r = await fetchEditorContent('d1', 'resume.docx');
    expect(r.ok).toBe(true);
    expect(r.content.type).toBe('doc');
  });

  it('converts markdown by extension', async () => {
    getDocumentText.mockResolvedValue({ ok: true, kind: 'text', content: '# Hi' });
    const r = await fetchEditorContent('d1', 'resume.md');
    expect(r.ok).toBe(true);
    expect(r.content.type).toBe('doc');
  });

  it('falls back to plain text', async () => {
    getDocumentText.mockResolvedValue({ ok: true, kind: 'text', content: 'plain line' });
    const r = await fetchEditorContent('d1', 'resume.pdf');
    expect(r.content.content[0].content[0].text).toBe('plain line');
  });

  it('returns ok:false when the file has no selectable text', async () => {
    getDocumentText.mockResolvedValue({ ok: false });
    const r = await fetchEditorContent('d1', 'scan.pdf');
    expect(r).toEqual({ ok: false });
  });
});
