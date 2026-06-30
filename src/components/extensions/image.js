import Image from '@tiptap/extension-image';

// Image node extended with width + align attributes and a corner drag-resize
// handle (vanilla NodeView). Inline-resize is verified manually / in e2e
// (jsdom can't simulate pointer drag); the attribute commands are unit-tested.
export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => el.style.width || el.getAttribute('width') || null,
        renderHTML: (attrs) => (attrs.width ? { style: `width: ${attrs.width}` } : {}),
      },
      align: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-align'),
        renderHTML: (attrs) => (attrs.align ? { 'data-align': attrs.align } : {}),
      },
    };
  },

  addCommands() {
    return {
      ...this.parent?.(),
      setImageWidth:
        (width) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, { width }),
      setImageAlign:
        (align) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, { align }),
    };
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = document.createElement('div');
      dom.className = 'tiptap-image';
      if (node.attrs.align) dom.setAttribute('data-align', node.attrs.align);

      const img = document.createElement('img');
      img.src = node.attrs.src;
      if (node.attrs.alt) img.alt = node.attrs.alt;
      if (node.attrs.width) img.style.width = node.attrs.width;
      dom.appendChild(img);

      const handle = document.createElement('span');
      handle.className = 'tiptap-image__handle';
      handle.contentEditable = 'false';
      dom.appendChild(handle);

      let startX = 0;
      let startW = 0;
      const onMove = (e) => {
        const newW = Math.max(40, startW + (e.clientX - startX));
        img.style.width = `${newW}px`;
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        if (typeof getPos === 'function') {
          const pos = getPos();
          editor
            .chain()
            .command(({ tr, state }) => {
              const currentAttrs = state.doc.nodeAt(pos)?.attrs ?? node.attrs;
              tr.setNodeMarkup(pos, undefined, { ...currentAttrs, width: img.style.width });
              return true;
            })
            .run();
        }
      };
      handle.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        startX = e.clientX;
        startW = img.getBoundingClientRect().width || img.naturalWidth || 200;
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
      });

      return { dom };
    };
  },
});
