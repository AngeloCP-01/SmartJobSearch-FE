import { Extension } from '@tiptap/core';

// Adds a `lineHeight` attribute to paragraph/heading nodes (TipTap v2 has no
// official line-height extension). Inline style overrides prose's line-height.
export const LineHeight = Extension.create({
  name: 'lineHeight',

  addOptions() {
    return { types: ['paragraph', 'heading'] };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (element) => element.style.lineHeight || null,
            renderHTML: (attributes) =>
              attributes.lineHeight ? { style: `line-height: ${attributes.lineHeight}` } : {},
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setLineHeight:
        (value) =>
        ({ commands }) =>
          this.options.types.every((type) => commands.updateAttributes(type, { lineHeight: value })),
      unsetLineHeight:
        () =>
        ({ commands }) =>
          this.options.types.every((type) => commands.resetAttributes(type, 'lineHeight')),
    };
  },
});
