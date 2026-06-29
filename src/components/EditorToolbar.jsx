import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, Heading3, List, ListOrdered, Link as LinkIcon,
  AlignLeft, AlignCenter, AlignRight, Undo2, Redo2,
} from 'lucide-react';

function Btn({ label, active, disabled, onClick, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active ?? undefined}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600
        transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500
        disabled:opacity-40 disabled:cursor-not-allowed ${active ? 'bg-sky-100 text-sky-700' : ''}`}
    >
      {children}
    </button>
  );
}

export default function EditorToolbar({ editor }) {
  if (!editor) return null;
  const chain = () => editor.chain().focus();

  const setLink = () => {
    const prev = editor.getAttributes('link').href || '';
    const url = window.prompt('Link URL', prev);
    if (url === null) return; // cancelled
    if (url === '') { chain().unsetLink().run(); return; }
    chain().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-t-xl border border-b-0 border-sky-100 bg-white px-2 py-1.5">
      <Btn label="Undo" disabled={!editor.can().undo()} onClick={() => chain().undo().run()}><Undo2 size={16} /></Btn>
      <Btn label="Redo" disabled={!editor.can().redo()} onClick={() => chain().redo().run()}><Redo2 size={16} /></Btn>
      <span className="mx-1 h-5 w-px bg-slate-200" />
      <Btn label="Bold" active={editor.isActive('bold')} onClick={() => chain().toggleBold().run()}><Bold size={16} /></Btn>
      <Btn label="Italic" active={editor.isActive('italic')} onClick={() => chain().toggleItalic().run()}><Italic size={16} /></Btn>
      <Btn label="Underline" active={editor.isActive('underline')} onClick={() => chain().toggleUnderline().run()}><UnderlineIcon size={16} /></Btn>
      <Btn label="Strikethrough" active={editor.isActive('strike')} onClick={() => chain().toggleStrike().run()}><Strikethrough size={16} /></Btn>
      <span className="mx-1 h-5 w-px bg-slate-200" />
      <Btn label="Heading 1" active={editor.isActive('heading', { level: 1 })} onClick={() => chain().toggleHeading({ level: 1 }).run()}><Heading1 size={16} /></Btn>
      <Btn label="Heading 2" active={editor.isActive('heading', { level: 2 })} onClick={() => chain().toggleHeading({ level: 2 }).run()}><Heading2 size={16} /></Btn>
      <Btn label="Heading 3" active={editor.isActive('heading', { level: 3 })} onClick={() => chain().toggleHeading({ level: 3 }).run()}><Heading3 size={16} /></Btn>
      <span className="mx-1 h-5 w-px bg-slate-200" />
      <Btn label="Bullet list" active={editor.isActive('bulletList')} onClick={() => chain().toggleBulletList().run()}><List size={16} /></Btn>
      <Btn label="Numbered list" active={editor.isActive('orderedList')} onClick={() => chain().toggleOrderedList().run()}><ListOrdered size={16} /></Btn>
      <Btn label="Link" active={editor.isActive('link')} onClick={setLink}><LinkIcon size={16} /></Btn>
      <span className="mx-1 h-5 w-px bg-slate-200" />
      <Btn label="Align left" active={editor.isActive({ textAlign: 'left' })} onClick={() => chain().setTextAlign('left').run()}><AlignLeft size={16} /></Btn>
      <Btn label="Align center" active={editor.isActive({ textAlign: 'center' })} onClick={() => chain().setTextAlign('center').run()}><AlignCenter size={16} /></Btn>
      <Btn label="Align right" active={editor.isActive({ textAlign: 'right' })} onClick={() => chain().setTextAlign('right').run()}><AlignRight size={16} /></Btn>
    </div>
  );
}
