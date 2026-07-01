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
const imgAttrs = (editor) => editor.getJSON().content.find((n) => n.type === 'image').attrs;

test('align buttons set the image align', async () => {
  const editor = makeEditor();
  const user = userEvent.setup();
  render(<ImageOptions editor={editor} />);
  await user.click(screen.getByRole('button', { name: 'Align image center' }));
  expect(imgAttrs(editor).align).toBe('center');
});

test('size presets set the image width', async () => {
  const editor = makeEditor();
  const user = userEvent.setup();
  render(<ImageOptions editor={editor} />);
  await user.click(screen.getByRole('button', { name: /medium/i }));
  expect(imgAttrs(editor).width).toBe('50%');
});

test('delete removes the image', async () => {
  const editor = makeEditor();
  const user = userEvent.setup();
  render(<ImageOptions editor={editor} />);
  await user.click(screen.getByRole('button', { name: 'Delete image' }));
  expect(editor.getJSON().content.find((n) => n.type === 'image')).toBeUndefined();
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
