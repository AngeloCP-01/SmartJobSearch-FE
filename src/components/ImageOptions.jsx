import { useRef } from 'react';
import { AlignLeft, AlignCenter, AlignRight, RefreshCw, Trash2 } from 'lucide-react';
import { uploadImage } from '../api/images';

const SIZES = [
  { label: 'Small', title: 'Small (25%)', value: '25%' },
  { label: 'Medium', title: 'Medium (50%)', value: '50%' },
  { label: 'Full', title: 'Full width (100%)', value: '100%' },
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
  const fileRef = useRef(null);
  if (!editor) return null;
  const chain = () => editor.chain().focus();
  const align = editor.getAttributes('image').align;
  const width = editor.getAttributes('image').width;

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
      <IconBtn label="Align image left" active={align === 'left'} onClick={() => chain().setImageAlign('left').run()}><AlignLeft size={16} /></IconBtn>
      <IconBtn label="Align image center" active={align === 'center'} onClick={() => chain().setImageAlign('center').run()}><AlignCenter size={16} /></IconBtn>
      <IconBtn label="Align image right" active={align === 'right'} onClick={() => chain().setImageAlign('right').run()}><AlignRight size={16} /></IconBtn>
      <span className="mx-0.5 h-5 w-px bg-slate-200" />
      {SIZES.map((s) => (
        <button
          key={s.value}
          type="button"
          aria-label={s.title}
          title={s.title}
          aria-pressed={width === s.value || undefined}
          onClick={() => chain().setImageWidth(s.value).run()}
          className={`h-8 rounded-md px-2 text-xs font-medium text-slate-600 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${width === s.value ? 'bg-sky-100 text-sky-700' : ''}`}
        >
          {s.label}
        </button>
      ))}
      <span className="mx-0.5 h-5 w-px bg-slate-200" />
      <label className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md px-2 text-xs font-medium text-slate-600 hover:bg-slate-100" title="Replace image">
        <RefreshCw size={14} aria-hidden="true" /> Replace
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" aria-label="Replace image" className="sr-only" onChange={onReplace} />
      </label>
      <IconBtn label="Delete image" onClick={() => chain().deleteSelection().run()}><Trash2 size={16} /></IconBtn>
    </div>
  );
}
