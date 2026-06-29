import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { renderHook } from '@testing-library/react';
import EditorToolbar from './EditorToolbar';

afterEach(cleanup);

function useTestEditor() {
  return useEditor({
    extensions: [StarterKit],
    content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hello world' }] }] },
  });
}

test('bold button toggles the bold mark on the selection', async () => {
  const { result } = renderHook(() => useTestEditor());
  const editor = result.current;
  editor.commands.selectAll();
  render(<EditorToolbar editor={editor} />);

  expect(editor.isActive('bold')).toBe(false);
  await userEvent.click(screen.getByRole('button', { name: /bold/i }));
  expect(editor.isActive('bold')).toBe(true);
});

test('bullet list button toggles a bullet list', async () => {
  const { result } = renderHook(() => useTestEditor());
  const editor = result.current;
  editor.commands.selectAll();
  render(<EditorToolbar editor={editor} />);

  await userEvent.click(screen.getByRole('button', { name: /bullet list/i }));
  expect(editor.isActive('bulletList')).toBe(true);
});

test('renders nothing without an editor', () => {
  const { container } = render(<EditorToolbar editor={null} />);
  expect(container).toBeEmptyDOMElement();
});
