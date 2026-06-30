import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { LineHeight } from './lineHeight';

function makeEditor() {
  return new Editor({
    element: document.createElement('div'),
    extensions: [StarterKit, LineHeight],
    content: '<p>hello</p>',
  });
}

test('setLineHeight applies a line-height to the paragraph', () => {
  const editor = makeEditor();
  editor.commands.selectAll();
  editor.commands.setLineHeight('1.5');
  expect(editor.getAttributes('paragraph').lineHeight).toBe('1.5');
  editor.destroy();
});

test('unsetLineHeight clears the line-height', () => {
  const editor = makeEditor();
  editor.commands.selectAll();
  editor.commands.setLineHeight('2');
  editor.commands.unsetLineHeight();
  expect(editor.getAttributes('paragraph').lineHeight ?? null).toBe(null);
  editor.destroy();
});
