import { describe, test, expect } from 'vitest';
import { htmlToProseMirrorDoc } from './htmlToProseMirror';

describe('htmlToProseMirrorDoc', () => {
  test('converts HTML structure (paragraphs, bold, lists) to ProseMirror JSON', () => {
    const doc = htmlToProseMirrorDoc('<p><strong>Summary</strong></p><ul><li>one</li><li>two</li></ul>');
    expect(doc.type).toBe('doc');
    const json = JSON.stringify(doc);
    expect(json).toContain('"type":"bold"');
    expect(json).toContain('"type":"bulletList"');
  });

  test('handles empty / nullish input without throwing', () => {
    expect(htmlToProseMirrorDoc('').type).toBe('doc');
    expect(htmlToProseMirrorDoc(null).type).toBe('doc');
  });
});
