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

test('height attribute round-trips through parse/render', () => {
  const editor = new Editor({
    element: document.createElement('div'),
    extensions: [StarterKit, ResizableImage],
    content: '<img src="http://x/a.png" style="width: 300px; height: 200px">',
  });
  const img = imageNode(editor);
  expect(img.attrs.width).toBe('300px');
  expect(img.attrs.height).toBe('200px');
  editor.destroy();
});

test('setImageSize sets width and height together', () => {
  const editor = makeEditor();
  editor.commands.setImage({ src: 'https://example.test/sig.png' });
  editor.commands.selectAll();
  editor.commands.setImageSize({ width: '250px', height: '160px' });
  const img = imageNode(editor);
  expect(img.attrs.width).toBe('250px');
  expect(img.attrs.height).toBe('160px');
  editor.destroy();
});

test('resetImageSize clears width and height', () => {
  const editor = makeEditor();
  editor.commands.setImage({ src: 'https://example.test/sig.png' });
  editor.commands.selectAll();
  editor.commands.setImageSize({ width: '250px', height: '160px' });
  editor.commands.resetImageSize();
  const img = imageNode(editor);
  expect(img.attrs.width).toBeNull();
  expect(img.attrs.height).toBeNull();
  editor.destroy();
});
