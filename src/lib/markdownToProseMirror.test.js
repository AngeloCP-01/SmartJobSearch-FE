import { describe, test, expect } from 'vitest';
import { markdownToProseMirrorDoc } from './markdownToProseMirror';

describe('markdownToProseMirrorDoc', () => {
  test('converts headings, bold, lists, and links to ProseMirror JSON', () => {
    const doc = markdownToProseMirrorDoc('# Title\n\n**bold** and [site](https://a.com)\n\n- one\n- two');
    expect(doc.type).toBe('doc');
    const json = JSON.stringify(doc);
    expect(json).toContain('"type":"heading"');
    expect(json).toContain('"type":"bold"');
    expect(json).toContain('"type":"bulletList"');
    expect(json).toContain('"type":"link"');
  });

  test('handles empty / nullish input without throwing', () => {
    const doc = markdownToProseMirrorDoc('');
    expect(doc.type).toBe('doc');
  });
});
