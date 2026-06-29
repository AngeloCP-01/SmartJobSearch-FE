import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { PageDocument } from './pageDocument';

function makeEditor(content) {
  return new Editor({
    element: document.createElement('div'),
    extensions: [StarterKit.configure({ document: false }), PageDocument],
    content: content || '<p>hi</p>',
  });
}

test('the document defaults to Letter / Normal', () => {
  const editor = makeEditor();
  expect(editor.state.doc.attrs.pageSize).toBe('Letter');
  expect(editor.state.doc.attrs.margin).toBe('Normal');
  editor.destroy();
});

test('setPageSettings updates the document attributes', () => {
  const editor = makeEditor();
  editor.commands.setPageSettings({ pageSize: 'A4', margin: 'Wide' });
  expect(editor.state.doc.attrs.pageSize).toBe('A4');
  expect(editor.state.doc.attrs.margin).toBe('Wide');
  editor.destroy();
});

test('setPageSettings can update a single setting', () => {
  const editor = makeEditor();
  editor.commands.setPageSettings({ margin: 'Narrow' });
  expect(editor.state.doc.attrs.pageSize).toBe('Letter'); // unchanged
  expect(editor.state.doc.attrs.margin).toBe('Narrow');
  editor.destroy();
});

test('a doc loaded without attrs still reports defaults (v1 back-compat)', () => {
  const editor = makeEditor({ type: 'doc', content: [{ type: 'paragraph' }] });
  expect(editor.state.doc.attrs.pageSize).toBe('Letter');
  expect(editor.state.doc.attrs.margin).toBe('Normal');
  editor.destroy();
});
