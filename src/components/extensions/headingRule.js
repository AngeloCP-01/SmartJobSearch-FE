import { Extension } from '@tiptap/core';

// Adds a boolean `rule` attribute to heading nodes, round-tripped as
// data-rule="true". Set by the DOCX importer on recognized section headings so
// CSS can draw the résumé section divider only where the source had one.
export const HeadingRule = Extension.create({
  name: 'headingRule',
  addGlobalAttributes() {
    return [
      {
        types: ['heading'],
        attributes: {
          rule: {
            default: false,
            parseHTML: (el) => el.getAttribute('data-rule') === 'true',
            renderHTML: (attrs) => (attrs.rule ? { 'data-rule': 'true' } : {}),
          },
        },
      },
    ];
  },
});
