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
      height: {
        default: null,
        parseHTML: (el) => el.style.height || el.getAttribute('height') || null,
        renderHTML: (attrs) => (attrs.height ? { style: `height: ${attrs.height}` } : {}),
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
      setImageSize:
        ({ width, height }) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, { width, height }),
      resetImageSize:
        () =>
        ({ commands }) =>
          commands.updateAttributes(this.name, { width: null, height: null }),
    };
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      let current = node;
      const dom = document.createElement('div');
      dom.className = 'tiptap-image';
      if (current.attrs.align) dom.setAttribute('data-align', current.attrs.align);

      const img = document.createElement('img');
      img.src = current.attrs.src;
      if (current.attrs.alt) img.alt = current.attrs.alt;
      dom.style.width = current.attrs.width || '';
      dom.style.height = current.attrs.height || '';
      img.style.width = '100%';
      img.style.height = '100%';
      dom.appendChild(img);

      const badge = document.createElement('span');
      badge.className = 'tiptap-image__dim';
      badge.contentEditable = 'false';

      const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
      const handleEls = HANDLES.map((h) => {
        const el = document.createElement('span');
        el.className = 'tiptap-image__handle';
        el.dataset.handle = h;
        el.contentEditable = 'false';
        dom.appendChild(el);
        return el;
      });

      let cleanup = null;
      const startDrag = (handle, e) => {
        e.preventDefault();
        e.stopPropagation();
        const rect = dom.getBoundingClientRect();
        const startX = e.clientX;
        const startY = e.clientY;
        const startW = rect.width;
        const startH = rect.height;
        const ratio =
          img.naturalWidth && img.naturalHeight
            ? img.naturalWidth / img.naturalHeight
            : startW / startH || 1;
        const isCorner = handle.length === 2;
        const west = handle.includes('w');
        const north = handle.includes('n');
        const changesW = isCorner || handle === 'e' || handle === 'w';
        const changesH = isCorner || handle === 'n' || handle === 's';
        const maxW = dom.parentElement?.clientWidth || Infinity;

        document.body.appendChild(badge);

        const onMove = (ev) => {
          const dx = ev.clientX - startX;
          const dy = ev.clientY - startY;
          let w = startW;
          let h = startH;
          if (isCorner) {
            w = Math.max(40, startW + (west ? -dx : dx));
            if (w > maxW) w = maxW;
            h = Math.max(40, w / ratio);
          } else if (changesW) {
            w = Math.max(40, Math.min(maxW, startW + (west ? -dx : dx)));
          } else if (changesH) {
            h = Math.max(40, startH + (north ? -dy : dy));
          }
          dom.style.width = `${Math.round(w)}px`;
          if (changesH || isCorner) dom.style.height = `${Math.round(h)}px`;
          const shown = dom.getBoundingClientRect();
          badge.textContent = `${Math.round(shown.width)} × ${Math.round(shown.height)}`;
          badge.style.left = `${ev.clientX + 12}px`;
          badge.style.top = `${ev.clientY + 12}px`;
        };
        const onUp = () => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          badge.remove();
          cleanup = null;
          if (typeof getPos === 'function') {
            const pos = getPos();
            const width = dom.style.width || null;
            const height = dom.style.height || null;
            editor
              .chain()
              .command(({ tr, state }) => {
                const attrs = state.doc.nodeAt(pos)?.attrs ?? current.attrs;
                tr.setNodeMarkup(pos, undefined, { ...attrs, width, height });
                return true;
              })
              .run();
          }
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        cleanup = () => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          badge.remove();
        };
      };

      handleEls.forEach((el) => {
        el.addEventListener('pointerdown', (e) => startDrag(el.dataset.handle, e));
      });

      return {
        dom,
        update(updated) {
          if (updated.type.name !== current.type.name) return false;
          current = updated;
          if (updated.attrs.align) dom.setAttribute('data-align', updated.attrs.align);
          else dom.removeAttribute('data-align');
          dom.style.width = updated.attrs.width || '';
          dom.style.height = updated.attrs.height || '';
          img.src = updated.attrs.src;
          return true;
        },
        selectNode() {
          dom.dataset.selected = 'true';
        },
        deselectNode() {
          delete dom.dataset.selected;
        },
        destroy() {
          if (cleanup) cleanup();
        },
      };
    };
  },
});
