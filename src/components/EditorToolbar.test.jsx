import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextStyle from '@tiptap/extension-text-style';
import FontFamily from '@tiptap/extension-font-family';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import { renderHook } from '@testing-library/react';
import { FontSize } from './extensions/fontSize';
import EditorToolbar from './EditorToolbar';

afterEach(cleanup);

function useTestEditor() {
  return useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      FontFamily,
      FontSize,
      Color,
      Highlight.configure({ multicolor: true }),
    ],
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

test('font family select applies the chosen font', async () => {
  const { result } = renderHook(() => useTestEditor());
  const editor = result.current;
  await act(async () => { editor.commands.selectAll(); });
  const user = userEvent.setup();
  render(<EditorToolbar editor={editor} />);

  await user.selectOptions(screen.getByLabelText('Font family'), 'Georgia, serif');
  expect(editor.getAttributes('textStyle').fontFamily).toBe('Georgia, serif');
});

test('font size select applies the chosen size', async () => {
  const { result } = renderHook(() => useTestEditor());
  const editor = result.current;
  await act(async () => { editor.commands.selectAll(); });
  const user = userEvent.setup();
  render(<EditorToolbar editor={editor} />);

  await user.selectOptions(screen.getByLabelText('Font size'), '14pt');
  expect(editor.getAttributes('textStyle').fontSize).toBe('14pt');
});

test('text color input applies a color', async () => {
  const { result } = renderHook(() => useTestEditor());
  const editor = result.current;
  await act(async () => { editor.commands.selectAll(); });
  render(<EditorToolbar editor={editor} />);

  await act(async () => {
    fireEvent.input(screen.getByLabelText('Text color'), { target: { value: '#ff0000' } });
  });
  expect(editor.getAttributes('textStyle').color).toBe('#ff0000');
});

test('highlight color input toggles a highlight mark', async () => {
  const { result } = renderHook(() => useTestEditor());
  const editor = result.current;
  await act(async () => { editor.commands.selectAll(); });
  render(<EditorToolbar editor={editor} />);

  await act(async () => {
    fireEvent.input(screen.getByLabelText('Highlight color'), { target: { value: '#fef08a' } });
  });
  expect(editor.isActive('highlight')).toBe(true);
});
