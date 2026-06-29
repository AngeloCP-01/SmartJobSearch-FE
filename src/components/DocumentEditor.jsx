import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import EditorToolbar from './EditorToolbar';

export default function DocumentEditor({ content, onChange }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: content || { type: 'doc', content: [{ type: 'paragraph' }] },
    editorProps: {
      attributes: {
        class: 'tiptap min-h-[60vh] rounded-b-xl border border-sky-100 bg-white p-6 focus:outline-none prose max-w-none',
      },
    },
    onUpdate: ({ editor }) => onChange?.(editor.getJSON()),
  });

  return (
    <div className="document-print-area">
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
