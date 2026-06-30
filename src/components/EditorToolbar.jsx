import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, Heading3, List, ListOrdered, Link as LinkIcon,
  AlignLeft, AlignCenter, AlignRight, Undo2, Redo2,
  Highlighter, Table as TableIcon, ListChecks, Search, Image as ImageIcon,
} from 'lucide-react';
import { useRef } from 'react';
import { FONTS, FONT_SIZES, LINE_HEIGHTS, DEFAULT_TEXT_COLOR, DEFAULT_HIGHLIGHT } from './editorConstants';
import { uploadImage } from '../api/images';

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

export default function EditorToolbar({ editor, onToggleSearch }) {
  if (!editor) return null;
  const chain = () => editor.chain().focus();

  const setLink = () => {
    const prev = editor.getAttributes('link').href || '';
    const input = window.prompt('Link URL', prev);
    if (input === null) return; // cancelled
    const url = input.trim();
    if (url === '') { chain().unsetLink().run(); return; }
    // Normalize a bare domain (e.g. "google.com") to an absolute https URL so
    // the link is real/clickable, not a broken relative link.
    const href = /^(https?:\/\/|mailto:|tel:)/i.test(url) ? url : `https://${url}`;
    chain().extendMarkRange('link').setLink({ href }).run();
  };

  const currentFont = editor.getAttributes('textStyle').fontFamily || '';
  const currentSize = editor.getAttributes('textStyle').fontSize || '';
  const currentLineHeight = editor.getAttributes('paragraph').lineHeight || editor.getAttributes('heading').lineHeight || '';
  const onLineHeight = (value) => {
    if (value) chain().setLineHeight(value).run();
    else chain().unsetLineHeight().run();
  };
  const fileRef = useRef(null);
  const onPickImage = () => fileRef.current?.click();
  const onImageFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const { url } = await uploadImage(file);
      chain().setImage({ src: url }).run();
    } catch {
      window.alert('Could not upload the image.');
    }
  };

  const currentColor = editor.getAttributes('textStyle').color || DEFAULT_TEXT_COLOR;
  const currentHighlight = editor.getAttributes('highlight').color || DEFAULT_HIGHLIGHT;

  const onFont = (value) => {
    if (value) chain().setFontFamily(value).run();
    else chain().unsetFontFamily().run();
  };
  const onSize = (value) => {
    if (value) chain().setFontSize(value).run();
    else chain().unsetFontSize().run();
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
      <Btn label="Checklist" active={editor.isActive('taskList')} onClick={() => chain().toggleTaskList().run()}><ListChecks size={16} /></Btn>
      <Btn label="Link" active={editor.isActive('link')} onClick={setLink}><LinkIcon size={16} /></Btn>
      <span className="mx-1 h-5 w-px bg-slate-200" />
      <Btn label="Align left" active={editor.isActive({ textAlign: 'left' })} onClick={() => chain().setTextAlign('left').run()}><AlignLeft size={16} /></Btn>
      <Btn label="Align center" active={editor.isActive({ textAlign: 'center' })} onClick={() => chain().setTextAlign('center').run()}><AlignCenter size={16} /></Btn>
      <Btn label="Align right" active={editor.isActive({ textAlign: 'right' })} onClick={() => chain().setTextAlign('right').run()}><AlignRight size={16} /></Btn>
      <select
        aria-label="Line spacing"
        value={currentLineHeight}
        onChange={(e) => onLineHeight(e.target.value)}
        className="h-8 rounded-md border border-slate-200 bg-white px-1 text-sm text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
      >
        <option value="">Spacing</option>
        {LINE_HEIGHTS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
      </select>
      <span className="mx-1 h-5 w-px bg-slate-200" />
      <select
        aria-label="Font family"
        value={currentFont}
        onChange={(e) => onFont(e.target.value)}
        className="h-8 rounded-md border border-slate-200 bg-white px-1 text-sm text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
      >
        {FONTS.map((f) => <option key={f.label} value={f.value}>{f.label}</option>)}
      </select>
      <select
        aria-label="Font size"
        value={currentSize}
        onChange={(e) => onSize(e.target.value)}
        className="h-8 rounded-md border border-slate-200 bg-white px-1 text-sm text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
      >
        <option value="">Size</option>
        {FONT_SIZES.map((s) => <option key={s} value={s}>{s.replace('pt', '')}</option>)}
      </select>
      <label className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md hover:bg-slate-100" title="Text color">
        <span className="text-sm font-semibold text-slate-700" aria-hidden="true">A</span>
        <input
          type="color"
          aria-label="Text color"
          value={currentColor}
          onChange={(e) => chain().setColor(e.target.value).run()}
          className="sr-only"
        />
      </label>
      <label className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md hover:bg-slate-100" title="Highlight">
        <Highlighter size={16} aria-hidden="true" />
        <input
          type="color"
          aria-label="Highlight color"
          value={currentHighlight}
          onChange={(e) => chain().toggleHighlight({ color: e.target.value }).run()}
          className="sr-only"
        />
      </label>
      <Btn label="Remove highlight" onClick={() => chain().unsetHighlight().run()}><Highlighter size={16} className="opacity-40" /></Btn>
      <span className="mx-1 h-5 w-px bg-slate-200" />
      <Btn label="Insert table" onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><TableIcon size={16} /></Btn>
      <label className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-slate-600 hover:bg-slate-100" title="Insert image">
        <ImageIcon size={16} aria-hidden="true" />
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" aria-label="Insert image" className="sr-only" onChange={onImageFile} />
      </label>
      {editor.isActive('image') && (
        <>
          <Btn label="Align image left" active={editor.isActive('image', { align: 'left' })} onClick={() => chain().setImageAlign('left').run()}><AlignLeft size={16} /></Btn>
          <Btn label="Align image center" active={editor.isActive('image', { align: 'center' })} onClick={() => chain().setImageAlign('center').run()}><AlignCenter size={16} /></Btn>
          <Btn label="Align image right" active={editor.isActive('image', { align: 'right' })} onClick={() => chain().setImageAlign('right').run()}><AlignRight size={16} /></Btn>
        </>
      )}
      <Btn label="Find and replace" onClick={() => onToggleSearch?.()}><Search size={16} /></Btn>
      {editor.isActive('table') && (
        <>
          <button type="button" aria-label="Add column" onClick={() => chain().addColumnAfter().run()} className="h-8 rounded-md px-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">Col+</button>
          <button type="button" aria-label="Delete column" onClick={() => chain().deleteColumn().run()} className="h-8 rounded-md px-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">Col−</button>
          <button type="button" aria-label="Add row" onClick={() => chain().addRowAfter().run()} className="h-8 rounded-md px-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">Row+</button>
          <button type="button" aria-label="Delete row" onClick={() => chain().deleteRow().run()} className="h-8 rounded-md px-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">Row−</button>
          <button type="button" aria-label="Toggle header row" onClick={() => chain().toggleHeaderRow().run()} className="h-8 rounded-md px-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">Header</button>
          <button type="button" aria-label="Delete table" onClick={() => chain().deleteTable().run()} className="h-8 rounded-md px-1.5 text-xs font-medium text-red-600 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">Delete</button>
        </>
      )}
    </div>
  );
}
