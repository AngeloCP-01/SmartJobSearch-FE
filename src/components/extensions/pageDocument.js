import Document from '@tiptap/extension-document';

// The root document node, extended to carry page-layout settings as attributes
// so they live inside the content JSON (no backend change) and autosave for free.
export const PageDocument = Document.extend({
  addAttributes() {
    return {
      pageSize: {
        default: 'Letter',
        parseHTML: (element) => element.getAttribute('data-page-size') || 'Letter',
        renderHTML: (attributes) => ({ 'data-page-size': attributes.pageSize }),
      },
      margin: {
        default: 'Normal',
        parseHTML: (element) => element.getAttribute('data-margin') || 'Normal',
        renderHTML: (attributes) => ({ 'data-margin': attributes.margin }),
      },
    };
  },

  addCommands() {
    return {
      setPageSettings:
        (settings) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            Object.entries(settings).forEach(([key, value]) => tr.setDocAttribute(key, value));
          }
          return true;
        },
    };
  },
});
