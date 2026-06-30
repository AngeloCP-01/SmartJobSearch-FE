import { useState } from 'react';
import { ChevronUp, ChevronDown, X } from 'lucide-react';
import { searchKey } from './extensions/findReplace';

export default function FindReplacePanel({ editor, onClose }) {
  const [term, setTerm] = useState('');
  const [replace, setReplace] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  if (!editor) return null;

  const state = searchKey.getState(editor.state) || { matches: [], activeIndex: 0 };
  const count = state.matches.length;
  const label = count ? `${state.activeIndex + 1} of ${count}` : term ? 'No results' : '';

  const onFind = (v) => { setTerm(v); editor.chain().setSearchTerm(v).run(); };
  const onReplaceChange = (v) => { setReplace(v); editor.chain().setReplaceTerm(v).run(); };
  const toggleCase = () => { const n = !caseSensitive; setCaseSensitive(n); editor.chain().setCaseSensitive(n).run(); };
  const close = () => { editor.chain().clearSearch().run(); onClose(); };

  const inputClass = 'h-8 w-40 rounded-md border border-slate-300 bg-white px-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500';
  const btnClass = 'h-8 rounded-md px-2 text-xs font-medium text-slate-600 hover:bg-slate-100';

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-sky-100 bg-sky-50 px-3 py-1.5">
      <input aria-label="Find" className={inputClass} placeholder="Find" value={term} onChange={(e) => onFind(e.target.value)} />
      <span className="min-w-[4rem] text-xs text-slate-500">{label}</span>
      <button type="button" aria-label="Previous match" className={btnClass} onClick={() => editor.chain().findPrev().run()}><ChevronUp size={16} /></button>
      <button type="button" aria-label="Next match" className={btnClass} onClick={() => editor.chain().findNext().run()}><ChevronDown size={16} /></button>
      <input aria-label="Replace" className={inputClass} placeholder="Replace with" value={replace} onChange={(e) => onReplaceChange(e.target.value)} />
      <button type="button" className={btnClass} onClick={() => editor.chain().replaceCurrent().run()}>Replace</button>
      <button type="button" className={btnClass} onClick={() => editor.chain().replaceAll().run()}>Replace all</button>
      <button type="button" aria-label="Match case" aria-pressed={caseSensitive} className={`${btnClass} ${caseSensitive ? 'bg-sky-100 text-sky-700' : ''}`} onClick={toggleCase}>Aa</button>
      <button type="button" aria-label="Close find" className={btnClass} onClick={close}><X size={16} /></button>
    </div>
  );
}
