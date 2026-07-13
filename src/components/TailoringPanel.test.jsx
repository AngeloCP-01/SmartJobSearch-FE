import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TailoringPanel from './TailoringPanel';
import { searchKey } from './extensions/findReplace';

vi.mock('./extensions/findReplace', () => ({
  searchKey: { getState: vi.fn(() => ({ matches: [{ from: 1, to: 5 }] })) },
}));

function makeEditor() {
  const calls = [];
  const chain = {};
  ['setSearchTerm', 'findNext', 'clearSearch'].forEach((m) => {
    chain[m] = (...a) => { calls.push([m, ...a]); return chain; };
  });
  chain.run = () => {};
  return { editor: { chain: () => chain, state: {} }, calls };
}

const tailoring = {
  meta: { position: 'Backend Engineer', companyName: 'Acme' },
  suggestions: [
    { kind: 'rephrase', text: 'Use "architected".', why: 'Stronger.', groundedIn: 'this résumé', anchor: 'built REST APIs', severity: 'low' },
    { kind: 'add', text: 'Mention Docker.', why: 'JD asks for it.', groundedIn: 'My Resume', anchor: '', severity: 'high' },
  ],
};

describe('TailoringPanel', () => {
  it('renders actionable suggestions and add-items as notes', () => {
    const { editor } = makeEditor();
    render(<TailoringPanel editor={editor} tailoring={tailoring} onClose={() => {}} />);
    expect(screen.getByText('Use "architected".')).toBeInTheDocument();
    expect(screen.getByText('Mention Docker.')).toBeInTheDocument();
    expect(screen.getByText(/Notes/i)).toBeInTheDocument(); // notes group header
  });

  it('locates a suggestion by its anchor on click', () => {
    const { editor, calls } = makeEditor();
    render(<TailoringPanel editor={editor} tailoring={tailoring} onClose={() => {}} />);
    fireEvent.click(screen.getByText('Use "architected".'));
    expect(calls).toContainEqual(['setSearchTerm', 'built REST APIs']);
    expect(calls).toContainEqual(['findNext']);
  });

  it('shows a hint when the anchor cannot be located', () => {
    searchKey.getState.mockReturnValueOnce({ matches: [] });
    const { editor } = makeEditor();
    render(<TailoringPanel editor={editor} tailoring={tailoring} onClose={() => {}} />);
    fireEvent.click(screen.getByText('Use "architected".'));
    expect(screen.getByText(/couldn't locate/i)).toBeInTheDocument();
  });

  it('clears the search when closed', () => {
    const { editor, calls } = makeEditor();
    const onClose = vi.fn();
    render(<TailoringPanel editor={editor} tailoring={tailoring} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close suggestions'));
    expect(calls).toContainEqual(['clearSearch']);
    expect(onClose).toHaveBeenCalled();
  });
});
