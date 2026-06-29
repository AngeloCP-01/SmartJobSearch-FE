import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import TextStyle from '@tiptap/extension-text-style';
import { FontSize } from './fontSize';

function makeEditor() {
  return new Editor({
    element: document.createElement('div'),
    extensions: [StarterKit, TextStyle, FontSize],
    content: '<p>hello world</p>',
  });
}

test('setFontSize applies a font-size to the textStyle mark', () => {
  const editor = makeEditor();
  editor.commands.selectAll();
  editor.commands.setFontSize('14pt');
  expect(editor.getAttributes('textStyle').fontSize).toBe('14pt');
  editor.destroy();
});

test('unsetFontSize clears the font-size', () => {
  const editor = makeEditor();
  editor.commands.selectAll();
  editor.commands.setFontSize('14pt');
  editor.commands.unsetFontSize();
  expect(editor.getAttributes('textStyle').fontSize ?? null).toBe(null);
  editor.destroy();
});
