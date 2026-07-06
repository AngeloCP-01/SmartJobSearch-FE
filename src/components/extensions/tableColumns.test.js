import { describe, test, expect } from 'vitest';
import { generateJSON, generateHTML } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import { TableColumns } from './tableColumns';

const ext = [StarterKit, Table, TableRow, TableHeader, TableCell, TableColumns];
const tableHtml = (cls) =>
  `<table${cls ? ` class="${cls}"` : ''}><tbody><tr><td>Mobile</td><td>Databases</td></tr></tbody></table>`;

describe('TableColumns', () => {
  test('parses the doc-columns class into a docColumns attribute', () => {
    const json = generateJSON(tableHtml('doc-columns'), ext);
    expect(json.content[0].attrs.docColumns).toBe(true);
  });

  test('renders the docColumns attribute back to the doc-columns class', () => {
    const json = generateJSON(tableHtml('doc-columns'), ext);
    expect(generateHTML(json, ext)).toContain('class="doc-columns"');
  });

  test('a plain table has docColumns=false and no doc-columns class', () => {
    const json = generateJSON(tableHtml(), ext);
    expect(json.content[0].attrs.docColumns).toBe(false);
    expect(generateHTML(json, ext)).not.toContain('doc-columns');
  });
});
