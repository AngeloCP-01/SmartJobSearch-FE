import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { ResizableImage } from './extensions/image';
import * as imagesApi from '../api/images';
import ImageOptions from './ImageOptions';

function makeEditor() {
  const editor = new Editor({
    element: document.createElement('div'),
    extensions: [StarterKit, ResizableImage],
    content: '<p>x</p>',
  });
  editor.commands.setImage({ src: 'http://x/a.png' });
  let pos = null;
  editor.state.doc.descendants((n, p) => { if (n.type.name === 'image') pos = p; });
  editor.commands.setNodeSelection(pos);
  return editor;
}
const imgAttrs = (editor) => {
  let found;
  editor.state.doc.descendants((n) => {
    if (n.type.name === 'image') found = n;
    return !found;
  });
  return found.attrs;
};

test('align buttons set the image align', async () => {
  const editor = makeEditor();
  const user = userEvent.setup();
  render(<ImageOptions editor={editor} />);
  await user.click(screen.getByRole('button', { name: 'Align image center' }));
  expect(imgAttrs(editor).align).toBe('center');
});

test('reset size clears the image width and height', async () => {
  const editor = makeEditor();
  editor.commands.setImageSize({ width: '250px', height: '160px' });
  const user = userEvent.setup();
  render(<ImageOptions editor={editor} />);
  await user.click(screen.getByRole('button', { name: /reset size/i }));
  const attrs = imgAttrs(editor);
  expect(attrs.width).toBeNull();
  expect(attrs.height).toBeNull();
});

test('no size preset buttons are rendered', () => {
  const editor = makeEditor();
  render(<ImageOptions editor={editor} />);
  expect(screen.queryByRole('button', { name: /small/i })).toBeNull();
  expect(screen.queryByRole('button', { name: /medium/i })).toBeNull();
  expect(screen.queryByRole('button', { name: /full/i })).toBeNull();
});

test('delete removes the image', async () => {
  const editor = makeEditor();
  const user = userEvent.setup();
  render(<ImageOptions editor={editor} />);
  await user.click(screen.getByRole('button', { name: 'Delete image' }));
  let img;
  editor.state.doc.descendants((n) => {
    if (n.type.name === 'image') img = n;
    return !img;
  });
  expect(img).toBeUndefined();
});

test('replace uploads a new file and swaps the src', async () => {
  vi.spyOn(imagesApi, 'uploadImage').mockResolvedValue({ id: 'x', url: 'http://x/new.png' });
  const editor = makeEditor();
  const user = userEvent.setup();
  render(<ImageOptions editor={editor} />);
  await user.upload(screen.getByLabelText('Replace image'), new File(['png'], 'new.png', { type: 'image/png' }));
  await waitFor(() => expect(imgAttrs(editor).src).toBe('http://x/new.png'));
});

test('buttons expose hover titles', () => {
  const editor = makeEditor();
  render(<ImageOptions editor={editor} />);
  expect(screen.getByRole('button', { name: 'Align image left' })).toHaveAttribute('title', 'Align image left');
});

test('renders the five wrap-mode buttons and sets the mode', async () => {
  const editor = makeEditor();
  const user = userEvent.setup();
  render(<ImageOptions editor={editor} />);
  for (const name of ['In line', 'Break text', 'Wrap text', 'In front of text', 'Behind text']) {
    expect(screen.getByRole('button', { name })).toBeInTheDocument();
  }
  await user.click(screen.getByRole('button', { name: 'Behind text' }));
  expect(imgAttrs(editor).wrap).toBe('behind');
});

test('hides align buttons for inline/front/behind modes', async () => {
  const editor = makeEditor();
  editor.commands.setImageWrap('front');
  const user = userEvent.setup();
  render(<ImageOptions editor={editor} />);
  expect(screen.queryByRole('button', { name: 'Align image left' })).toBeNull();
  // Switch to a flow mode → align reappears.
  await user.click(screen.getByRole('button', { name: 'Break text' }));
  expect(screen.getByRole('button', { name: 'Align image left' })).toBeInTheDocument();
});
