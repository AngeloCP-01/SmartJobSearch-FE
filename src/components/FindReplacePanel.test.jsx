import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { renderHook } from '@testing-library/react';
import { FindReplace } from './extensions/findReplace';
import FindReplacePanel from './FindReplacePanel';

function useTestEditor() {
  return useEditor({ extensions: [StarterKit, FindReplace], content: '<p>cat cat cat</p>' });
}

test('typing a term shows the match count', async () => {
  const { result } = renderHook(() => useTestEditor());
  const editor = result.current;
  const user = userEvent.setup();
  render(<FindReplacePanel editor={editor} onClose={() => {}} />);

  await user.type(screen.getByLabelText('Find'), 'cat');
  expect(screen.getByText(/1 of 3/i)).toBeInTheDocument();
});

test('Replace all updates the document and reports no results', async () => {
  const { result } = renderHook(() => useTestEditor());
  const editor = result.current;
  const user = userEvent.setup();
  render(<FindReplacePanel editor={editor} onClose={() => {}} />);

  await user.type(screen.getByLabelText('Find'), 'cat');
  await user.type(screen.getByLabelText('Replace'), 'dog');
  await user.click(screen.getByRole('button', { name: /replace all/i }));
  expect(editor.getText()).toBe('dog dog dog');
});

test('Close button calls onClose', async () => {
  const onClose = vi.fn();
  const { result } = renderHook(() => useTestEditor());
  const editor = result.current;
  const user = userEvent.setup();
  render(<FindReplacePanel editor={editor} onClose={onClose} />);

  await user.type(screen.getByLabelText('Find'), 'cat');
  await user.click(screen.getByRole('button', { name: /close find/i }));
  expect(onClose).toHaveBeenCalled();
});
