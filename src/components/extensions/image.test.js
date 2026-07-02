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
const imageNode = (editor) => {
  let found;
  editor.state.doc.descendants((n) => {
    if (n.type.name === 'image') found = n;
    return !found;
  });
  return found;
};

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

test('image node is inline', () => {
  const editor = makeEditor();
  expect(editor.schema.nodes.image.isInline).toBe(true);
  editor.destroy();
});

test('wrap, offsetX and offsetY attributes round-trip', () => {
  const editor = new Editor({
    element: document.createElement('div'),
    extensions: [StarterKit, ResizableImage],
    content: '<p><img src="http://x/a.png" data-wrap="front" data-offset-x="40" data-offset-y="15"></p>',
  });
  const img = imageNode(editor);
  expect(img.attrs.wrap).toBe('front');
  expect(img.attrs.offsetX).toBe(40);
  expect(img.attrs.offsetY).toBe(15);
  editor.destroy();
});

test('setImageWrap sets the wrap mode', () => {
  const editor = makeEditor();
  editor.commands.setImage({ src: 'https://example.test/sig.png' });
  editor.commands.selectAll();
  editor.commands.setImageWrap('wrap-left');
  expect(imageNode(editor).attrs.wrap).toBe('wrap-left');
  editor.destroy();
});

test('setImageWrap to a flow mode clears any offsets', () => {
  const editor = makeEditor();
  editor.commands.setImage({ src: 'https://example.test/sig.png' });
  editor.commands.selectAll();
  editor.commands.setImagePosition({ offsetX: 30, offsetY: 20 });
  editor.commands.setImageWrap('inline');
  const img = imageNode(editor);
  expect(img.attrs.wrap).toBe('inline');
  expect(img.attrs.offsetX).toBeNull();
  expect(img.attrs.offsetY).toBeNull();
  editor.destroy();
});

test('setImagePosition sets offsetX and offsetY', () => {
  const editor = makeEditor();
  editor.commands.setImage({ src: 'https://example.test/sig.png' });
  editor.commands.selectAll();
  editor.commands.setImagePosition({ offsetX: 12, offsetY: 34 });
  const img = imageNode(editor);
  expect(img.attrs.offsetX).toBe(12);
  expect(img.attrs.offsetY).toBe(34);
  editor.destroy();
});
