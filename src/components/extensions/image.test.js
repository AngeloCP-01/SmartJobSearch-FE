import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { ResizableImage } from './image';

function makeEditor() {
  return new Editor({
    element: document.createElement('div'),
    extensions: [StarterKit, ResizableImage],
    content: '<p>x</p>',
  });
}
const imageNode = (editor) => editor.getJSON().content.find((n) => n.type === 'image');

test('setImage inserts an image node with the given src', () => {
  const editor = makeEditor();
  editor.commands.setImage({ src: 'https://example.test/sig.png' });
  expect(imageNode(editor).attrs.src).toBe('https://example.test/sig.png');
  editor.destroy();
});

test('setImageWidth and setImageAlign update the selected image', () => {
  const editor = makeEditor();
  editor.commands.setImage({ src: 'https://example.test/sig.png' });
  editor.commands.selectAll();
  editor.commands.setImageWidth('220px');
  editor.commands.setImageAlign('center');
  const img = imageNode(editor);
  expect(img.attrs.width).toBe('220px');
  expect(img.attrs.align).toBe('center');
  editor.destroy();
});
