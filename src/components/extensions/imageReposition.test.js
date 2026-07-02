import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { ResizableImage } from './image';
import { sideForX, repositionImageNode } from './imageReposition';

test('sideForX returns wrap-left left of midpoint and wrap-right right of it', () => {
  expect(sideForX(10, 100)).toBe('wrap-left');
  expect(sideForX(150, 100)).toBe('wrap-right');
});

function editorWithImageInFirstPara() {
  const editor = new Editor({
    element: document.createElement('div'),
    extensions: [StarterKit, ResizableImage],
    content: '<p>alpha</p><p>beta</p>',
  });
  editor.commands.setTextSelection(1);
  editor.commands.setImage({ src: 'http://x/a.png' });
  return editor;
}
function imagePos(editor) {
  let pos = null;
  editor.state.doc.descendants((n, p) => { if (n.type.name === 'image') pos = p; });
  return pos;
}
function paraPositions(editor) {
  const paras = [];
  editor.state.doc.descendants((n, p) => { if (n.type.name === 'paragraph') paras.push(p); });
  return paras;
}

test('repositionImageNode moves the image to a new paragraph and patches attrs', () => {
  const editor = editorWithImageInFirstPara();
  const from = imagePos(editor);
  const secondParaInner = paraPositions(editor)[1] + 1; // inside the second paragraph
  const tr = repositionImageNode(editor.state, from, secondParaInner, { wrap: 'wrap-right' });
  expect(tr).not.toBeNull();
  editor.view.dispatch(tr);
  const moved = imagePos(editor);
  const secondPara = paraPositions(editor)[1];
  expect(moved).toBeGreaterThan(secondPara);
  let node = null;
  editor.state.doc.descendants((n) => { if (n.type.name === 'image') node = n; });
  expect(node.attrs.wrap).toBe('wrap-right');
  editor.destroy();
});

test('repositionImageNode returns null when there is no image at fromPos', () => {
  const editor = editorWithImageInFirstPara();
  expect(repositionImageNode(editor.state, 0, 5, {})).toBeNull();
  editor.destroy();
});

test('repositionImageNode returns null for a same-position no-op with no attr change', () => {
  const editor = editorWithImageInFirstPara();
  const from = imagePos(editor);
  expect(repositionImageNode(editor.state, from, from, {})).toBeNull();
  editor.destroy();
});
