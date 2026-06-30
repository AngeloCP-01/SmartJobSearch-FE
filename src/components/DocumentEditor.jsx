import { useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import FontFamily from '@tiptap/extension-font-family';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import EditorToolbar from './EditorToolbar';
import { FontSize } from './extensions/fontSize';
import { PageDocument } from './extensions/pageDocument';
import { FindReplace } from './extensions/findReplace';
import FindReplacePanel from './FindReplacePanel';
import { PAGE_SIZES, MARGINS, PAGE_WIDTH_CLASS, MARGIN_PAD_CLASS } from './editorConstants';

function pageOf(content) {
  return {
    pageSize: content?.attrs?.pageSize || 'Letter',
    margin: content?.attrs?.margin || 'Normal',
  };
}

export default function DocumentEditor({ content, onChange }) {
  const [page, setPage] = useState(() => pageOf(content));
  const [searchOpen, setSearchOpen] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, document: false }),
      PageDocument,
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      FontFamily,
      FontSize,
      Color,
      Highlight.configure({ multicolor: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      FindReplace,
    ],
    content: content || { type: 'doc', content: [{ type: 'paragraph' }] },
    editorProps: {
      attributes: { class: 'tiptap min-h-[9in] focus:outline-none prose max-w-none' },
    },
    onUpdate: ({ editor }) => {
      setPage({ pageSize: editor.state.doc.attrs.pageSize, margin: editor.state.doc.attrs.margin });
      onChange?.(editor.getJSON());
    },
  });

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const setPageSetting = (patch) => editor?.chain().setPageSettings(patch).run();

  const sheetClass = `editor-sheet mx-auto bg-white shadow-md ${PAGE_WIDTH_CLASS[page.pageSize]} ${MARGIN_PAD_CLASS[page.margin]}`;

  return (
    <div className="document-print-area">
      {/* Per-document print page size; margin handled by the sheet padding. */}
      <style>{`@media print { @page { size: ${page.pageSize}; margin: 0; } }`}</style>

      <div className="editor-chrome rounded-t-xl border border-b-0 border-sky-100 bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-sky-100 px-3 py-1.5 text-sm text-slate-600">
          <label className="inline-flex items-center gap-1">
            Page size
            <select
              aria-label="Page size"
              value={page.pageSize}
              onChange={(e) => setPageSetting({ pageSize: e.target.value })}
              className="rounded-md border border-slate-200 bg-white px-1 py-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              {PAGE_SIZES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </label>
          <label className="inline-flex items-center gap-1">
            Margins
            <select
              aria-label="Margins"
              value={page.margin}
              onChange={(e) => setPageSetting({ margin: e.target.value })}
              className="rounded-md border border-slate-200 bg-white px-1 py-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              {MARGINS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </label>
        </div>
        {searchOpen && <FindReplacePanel editor={editor} onClose={() => setSearchOpen(false)} />}
        <EditorToolbar editor={editor} onToggleSearch={() => setSearchOpen((o) => !o)} />
      </div>

      <div className="editor-canvas-backdrop rounded-b-xl border border-t-0 border-sky-100 bg-slate-100 p-6">
        <div className={sheetClass}>
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}
