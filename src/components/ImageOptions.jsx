import { useEffect, useState } from 'react';
import { RotateCcw, RefreshCw, Trash2, Type, Rows3, WrapText, BringToFront, SendToBack } from 'lucide-react';
import { uploadImage } from '../api/images';

const WRAP_MODES = [
  { mode: 'inline', label: 'In line', icon: Type },
  { mode: 'break', label: 'Break text', icon: Rows3 },
  { mode: 'wrap', label: 'Wrap text', icon: WrapText },
  { mode: 'front', label: 'In front of text', icon: BringToFront },
  { mode: 'behind', label: 'Behind text', icon: SendToBack },
];

function IconBtn({ label, active, onClick, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active ?? undefined}
      onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${active ? 'bg-sky-100 text-sky-700' : ''}`}
    >
      {children}
    </button>
  );
}

export default function ImageOptions({ editor }) {
  // Standalone (outside TipTap's BubbleMenu) this component isn't otherwise
  // re-rendered when the editor's active image attrs change, so subscribe to
  // transactions to keep the wrap-mode buttons in sync.
  const [, forceRender] = useState(0);
  useEffect(() => {
    if (!editor) return undefined;
    const rerender = () => forceRender((n) => n + 1);
    editor.on('transaction', rerender);
    return () => editor.off('transaction', rerender);
  }, [editor]);

  if (!editor) return null;
  const chain = () => editor.chain().focus();
  const wrap = editor.getAttributes('image').wrap || 'break';
  const isWrap = wrap === 'wrap-left' || wrap === 'wrap-right';

  // Positioning is drag-driven; "Wrap text" keeps the current side if already
  // wrapping, else defaults to wrap-left (dragging then changes the side).
  const applyWrap = (mode) => {
    if (mode === 'wrap') chain().setImageWrap(isWrap ? wrap : 'wrap-left').run();
    else chain().setImageWrap(mode).run();
  };
  const wrapActive = (mode) => (mode === 'wrap' ? isWrap : wrap === mode);

  const onReplace = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const { url } = await uploadImage(file);
      chain().updateAttributes('image', { src: url }).run();
    } catch {
      window.alert('Could not upload the image.');
    }
  };

  return (
    <div className="image-options flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-md">
      {WRAP_MODES.map(({ mode, label, icon: Icon }) => (
        <IconBtn key={mode} label={label} active={wrapActive(mode)} onClick={() => applyWrap(mode)}>
          <Icon size={16} />
        </IconBtn>
      ))}
      <span className="mx-0.5 h-5 w-px bg-slate-200" />
      <button
        type="button"
        aria-label="Reset size"
        title="Reset to original size"
        onClick={() => chain().resetImageSize().run()}
        className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-slate-600 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
      >
        <RotateCcw size={14} aria-hidden="true" /> Reset size
      </button>
      <span className="mx-0.5 h-5 w-px bg-slate-200" />
      <label className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md px-2 text-xs font-medium text-slate-600 hover:bg-slate-100" title="Replace image">
        <RefreshCw size={14} aria-hidden="true" /> Replace
        <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" aria-label="Replace image" className="sr-only" onChange={onReplace} />
      </label>
      <IconBtn label="Delete image" onClick={() => chain().deleteSelection().run()}><Trash2 size={16} /></IconBtn>
    </div>
  );
}
