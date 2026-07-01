import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DocumentEditor from './DocumentEditor';

// TipTap's BubbleMenu pulls in tippy.js, which crashes under Vitest/jsdom
// (`tippy is not a function` — an ESM/CJS interop issue). The bubble menu's
// floating behavior is verified manually / in e2e; here we stub it to render
// nothing so the rest of DocumentEditor can be tested. Other exports are real.
vi.mock('@tiptap/react', async (importOriginal) => ({
  ...(await importOriginal()),
  BubbleMenu: () => null,
}));

test('renders the page-setup selects defaulting to Letter / Normal', async () => {
  render(<DocumentEditor content={{ type: 'doc', content: [{ type: 'paragraph' }] }} onChange={() => {}} />);
  // useEditor mounts asynchronously; wait for the controls.
  expect(await screen.findByLabelText('Page size')).toHaveValue('Letter');
  expect(screen.getByLabelText('Margins')).toHaveValue('Normal');
});

test('changing the page size updates the sheet width and emits onChange', async () => {
  const onChange = vi.fn();
  render(<DocumentEditor content={{ type: 'doc', content: [{ type: 'paragraph' }] }} onChange={onChange} />);
  const pageSize = await screen.findByLabelText('Page size');

  const user = userEvent.setup();
  await act(async () => { await user.selectOptions(pageSize, 'A4'); });

  expect(screen.getByLabelText('Page size')).toHaveValue('A4');
  // The sheet element carries the A4 width class.
  expect(document.querySelector('.editor-sheet')).toHaveClass('w-[210mm]');
  expect(onChange).toHaveBeenCalled();
});

test('seeds the sheet from existing page attributes in content', async () => {
  render(
    <DocumentEditor
      content={{ type: 'doc', attrs: { pageSize: 'A4', margin: 'Wide' }, content: [{ type: 'paragraph' }] }}
      onChange={() => {}}
    />,
  );
  expect(await screen.findByLabelText('Page size')).toHaveValue('A4');
  expect(document.querySelector('.editor-sheet')).toHaveClass('w-[210mm]', 'p-[1.5in]');
});
