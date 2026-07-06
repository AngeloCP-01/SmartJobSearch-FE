import { describe, test, expect } from 'vitest';
import { generateHTML } from '@tiptap/core';
import { htmlToProseMirrorDoc, editorImportExtensions } from './htmlToProseMirror';

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

  test('preserves a ruled heading, a table, and centered alignment', () => {
    const html =
      '<h2 data-rule="true">SUMMARY</h2>' +
      '<table class="doc-columns"><tbody><tr><td>Mobile</td><td>Databases</td></tr></tbody></table>' +
      '<p style="text-align:center">Angelito C. Paa</p>';
    const doc = htmlToProseMirrorDoc(html);
    const json = JSON.stringify(doc);
    expect(json).toContain('"rule":true');
    expect(json).toContain('"type":"table"');
    expect(json).toContain('"textAlign":"center"');
  });

  test('preserves the doc-columns class through import and render', () => {
    const doc = htmlToProseMirrorDoc(
      '<table class="doc-columns"><tbody><tr><td>Mobile</td><td>Databases</td></tr></tbody></table>'
    );
    const rendered = generateHTML(doc, editorImportExtensions);
    expect(rendered).toContain('class="doc-columns"');
  });

  test('does not add the doc-columns class to a plain table', () => {
    const doc = htmlToProseMirrorDoc(
      '<table><tbody><tr><td>Mobile</td><td>Databases</td></tr></tbody></table>'
    );
    const rendered = generateHTML(doc, editorImportExtensions);
    expect(rendered).not.toContain('doc-columns');
  });
});
