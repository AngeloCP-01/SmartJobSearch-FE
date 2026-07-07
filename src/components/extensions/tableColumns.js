import { Extension } from '@tiptap/core';

// TipTap's Table extension drops arbitrary class attributes on import. The DOCX
// importer emits <table class="doc-columns"> for tab-aligned two-column lines,
// styled borderless in index.css. This preserves that class through import/render
// so the styling actually applies. Mirrors the HeadingRule extension pattern.
export const TableColumns = Extension.create({
  name: 'tableColumns',
  addGlobalAttributes() {
    return [
      {
        types: ['table'],
        attributes: {
          docColumns: {
            default: false,
            parseHTML: (el) => el.classList?.contains('doc-columns') || false,
            renderHTML: (attrs) => (attrs.docColumns ? { class: 'doc-columns' } : {}),
          },
        },
      },
    ];
  },
});
