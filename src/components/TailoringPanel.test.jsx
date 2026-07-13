import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TailoringPanel from './TailoringPanel';
import { searchKey } from './extensions/findReplace';

vi.mock('./extensions/findReplace', () => ({
  searchKey: { getState: vi.fn(() => ({ matches: [{ from: 1, to: 5 }] })) },
}));

// Record command calls and chain calls SEPARATELY. locate() must drive the
// editor via editor.commands (two separate dispatches) — NOT editor.chain() —
// because chaining setSearchTerm+findNext makes findNext read the previous
// term's stale matches, so repeat locate clicks stop moving the highlight
// (caught in manual e2e, 2026-07-13). Asserting on commandCalls guards that.
function makeEditor() {
  const commandCalls = [];
  const chainCalls = [];
  const chain = {};
  ['setSearchTerm', 'findNext', 'clearSearch'].forEach((m) => {
    chain[m] = (...a) => { chainCalls.push([m, ...a]); return chain; };
  });
  chain.run = () => {};
  const commands = {};
  ['setSearchTerm', 'findNext', 'clearSearch'].forEach((m) => {
    commands[m] = (...a) => { commandCalls.push([m, ...a]); return true; };
  });
  return { editor: { chain: () => chain, commands, state: {} }, commandCalls, chainCalls };
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

  it('locates a suggestion via separate commands (setSearchTerm then findNext)', () => {
    const { editor, commandCalls, chainCalls } = makeEditor();
    render(<TailoringPanel editor={editor} tailoring={tailoring} onClose={() => {}} />);
    fireEvent.click(screen.getByText('Use "architected".'));
    // Must be two separate commands, in order — not a single chain (regression guard).
    expect(commandCalls[0]).toEqual(['setSearchTerm', 'built REST APIs']);
    expect(commandCalls[1]).toEqual(['findNext']);
    expect(chainCalls).not.toContainEqual(['setSearchTerm', 'built REST APIs']);
  });

  it('shows a hint when the anchor cannot be located', () => {
    searchKey.getState.mockReturnValueOnce({ matches: [] });
    const { editor } = makeEditor();
    render(<TailoringPanel editor={editor} tailoring={tailoring} onClose={() => {}} />);
    fireEvent.click(screen.getByText('Use "architected".'));
    expect(screen.getByText(/couldn't locate/i)).toBeInTheDocument();
  });

  it('clears the search when closed', () => {
    const { editor, chainCalls } = makeEditor();
    const onClose = vi.fn();
    render(<TailoringPanel editor={editor} tailoring={tailoring} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close suggestions'));
    expect(chainCalls).toContainEqual(['clearSearch']);
    expect(onClose).toHaveBeenCalled();
  });
});
