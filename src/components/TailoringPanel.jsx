import { useState } from 'react';
import { X } from 'lucide-react';
import { searchKey } from './extensions/findReplace';

const dot = { high: 'bg-red-500', medium: 'bg-amber-500', low: 'bg-slate-400' };
const kindLabel = { add: 'Add', emphasize: 'Emphasize', rephrase: 'Rephrase', remove: 'Remove' };

// A working-aid side panel shown in the editor when arriving from Tailor Résumé.
// Lists the AI suggestions; clicking one highlights the verbatim résumé snippet
// it targets (via the Find/Replace extension). It NEVER edits the résumé — the
// user applies every change by hand. `add` items are read-only notes.
export default function TailoringPanel({ editor, tailoring, onClose }) {
  const [checked, setChecked] = useState({});
  const [missId, setMissId] = useState(null);
  if (!editor || !tailoring) return null;

  const { suggestions = [], meta } = tailoring;
  const actionable = suggestions.filter((s) => s.kind !== 'add');
  const notes = suggestions.filter((s) => s.kind === 'add');

  const locate = (s, id) => {
    if (!s.anchor) { setMissId(id); return; }
    // Two SEPARATE dispatches, not one chain: findNext must run against the match
    // set that setSearchTerm just produced. Chained in a single transaction,
    // findNext reads the PREVIOUS term's (stale) matches, so the second and later
    // locate clicks never move the highlight. Separate commands let editor.state
    // update between them.
    editor.commands.setSearchTerm(s.anchor);
    const found = (searchKey.getState(editor.state)?.matches.length || 0) > 0;
    if (found) editor.commands.findNext();
    setMissId(found ? null : id);
  };
  const close = () => { editor.chain().clearSearch().run(); onClose?.(); };

  return (
    <aside className="w-72 shrink-0 rounded-xl border border-sky-100 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Tailoring suggestions</h2>
        <button type="button" aria-label="Close suggestions" className="rounded p-1 text-slate-400 hover:bg-slate-100" onClick={close}>
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      {meta?.position && <p className="mb-2 text-xs text-slate-400">{meta.position}{meta.companyName && meta.companyName !== 'the company' ? ` · ${meta.companyName}` : ''}</p>}

      {actionable.length === 0 && notes.length === 0 && (
        <p className="text-sm text-slate-500">No suggestions.</p>
      )}

      <ul className="flex flex-col gap-2">
        {actionable.map((s, i) => (
          <li key={`a${i}`} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                aria-label={`Done: ${s.text}`}
                className="mt-1 h-4 w-4 shrink-0"
                checked={Boolean(checked[`a${i}`])}
                onChange={() => setChecked((c) => ({ ...c, [`a${i}`]: !c[`a${i}`] }))}
              />
              <button type="button" className={`text-left ${checked[`a${i}`] ? 'opacity-50' : ''}`} onClick={() => locate(s, `a${i}`)}>
                <span className="mb-0.5 flex items-center gap-2">
                  <span className={`inline-block h-2 w-2 rounded-full ${dot[s.severity]}`} aria-hidden="true" />
                  <span className="rounded bg-sky-100 px-1.5 py-0.5 text-xs font-medium text-sky-800">{kindLabel[s.kind]}</span>
                </span>
                <span className="block text-sm font-medium text-slate-800">{s.text}</span>
                <span className="block text-xs text-slate-500">{s.why}</span>
              </button>
            </div>
            {missId === `a${i}` && (
              <p className="mt-1 text-xs italic text-amber-600">Couldn't locate this in the résumé — edit manually.</p>
            )}
          </li>
        ))}
      </ul>

      {notes.length > 0 && (
        <div className="mt-3">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Notes (not applied)</h3>
          <ul className="flex flex-col gap-2">
            {notes.map((s, i) => (
              <li key={`n${i}`} className="rounded-lg border border-slate-200 bg-white p-2">
                <p className="text-sm font-medium text-slate-800">{s.text}</p>
                <p className="text-xs text-slate-500">{s.why}</p>
                <p className="mt-0.5 text-xs italic text-slate-400">Grounded in {s.groundedIn}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
