import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextStyle from '@tiptap/extension-text-style';
import FontFamily from '@tiptap/extension-font-family';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
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
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
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

  // Use a swatch different from the input's controlled default (#fef08a) so the
  // change event actually fires (React skips onChange when the value is unchanged).
  await act(async () => {
    fireEvent.input(screen.getByLabelText('Highlight color'), { target: { value: '#bbf7d0' } });
  });
  expect(editor.isActive('highlight')).toBe(true);
});

test('insert table button creates a table', async () => {
  const { result } = renderHook(() => useTestEditor());
  const editor = result.current;
  const user = userEvent.setup();
  render(<EditorToolbar editor={editor} />);

  await user.click(screen.getByRole('button', { name: /insert table/i }));
  expect(editor.isActive('table')).toBe(true);
});

test('table-edit buttons are hidden outside a table and shown inside', async () => {
  const { result } = renderHook(() => useTestEditor());
  const editor = result.current;
  const user = userEvent.setup();
  const { rerender } = render(<EditorToolbar editor={editor} />);

  expect(screen.queryByRole('button', { name: /add column/i })).toBeNull();

  await user.click(screen.getByRole('button', { name: /insert table/i }));
  rerender(<EditorToolbar editor={editor} />);
  expect(screen.getByRole('button', { name: /add column/i })).toBeInTheDocument();
});

test('add row increases the table row count', async () => {
  const { result } = renderHook(() => useTestEditor());
  const editor = result.current;
  const user = userEvent.setup();
  const { rerender } = render(<EditorToolbar editor={editor} />);

  await user.click(screen.getByRole('button', { name: /insert table/i }));
  const rowsBefore = editor.getJSON().content.find((n) => n.type === 'table').content.length;
  rerender(<EditorToolbar editor={editor} />);
  await user.click(screen.getByRole('button', { name: /add row/i }));
  const rowsAfter = editor.getJSON().content.find((n) => n.type === 'table').content.length;
  expect(rowsAfter).toBe(rowsBefore + 1);
});

test('checklist button toggles a task list', async () => {
  const { result } = renderHook(() => useTestEditor());
  const editor = result.current;
  await act(async () => { editor.commands.selectAll(); });
  const user = userEvent.setup();
  render(<EditorToolbar editor={editor} />);

  await user.click(screen.getByRole('button', { name: /checklist/i }));
  expect(editor.isActive('taskList')).toBe(true);
});
