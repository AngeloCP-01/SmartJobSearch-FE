import { render, screen, cleanup, act } from '@testing-library/react';
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
  // selectAll dispatches a transaction; wrap it so the useEditor hook's
  // re-render is flushed inside act() (keeps test output pristine).
  await act(async () => { editor.commands.selectAll(); });
  const user = userEvent.setup();
  render(<EditorToolbar editor={editor} />);

  expect(editor.isActive('bold')).toBe(false);
  await user.click(screen.getByRole('button', { name: /bold/i }));
  expect(editor.isActive('bold')).toBe(true);
});

test('bullet list button toggles a bullet list', async () => {
  const { result } = renderHook(() => useTestEditor());
  const editor = result.current;
  await act(async () => { editor.commands.selectAll(); });
  const user = userEvent.setup();
  render(<EditorToolbar editor={editor} />);

  await user.click(screen.getByRole('button', { name: /bullet list/i }));
  expect(editor.isActive('bulletList')).toBe(true);
});

test('renders nothing without an editor', () => {
  const { container } = render(<EditorToolbar editor={null} />);
  expect(container).toBeEmptyDOMElement();
});
