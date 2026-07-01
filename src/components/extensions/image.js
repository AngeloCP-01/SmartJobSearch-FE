import Image from '@tiptap/extension-image';
import { NodeSelection } from '@tiptap/pm/state';

// Image node extended with width + align attributes and a corner drag-resize
// handle (vanilla NodeView). Inline-resize is verified manually / in e2e
// (jsdom can't simulate pointer drag); the attribute commands are unit-tested.
export const ResizableImage = Image.extend({
  addOptions() {
    return { ...this.parent?.(), inline: true };
  },

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
      wrap: {
        default: 'break',
        parseHTML: (el) => el.getAttribute('data-wrap') || 'break',
        renderHTML: (attrs) =>
          attrs.wrap && attrs.wrap !== 'break' ? { 'data-wrap': attrs.wrap } : {},
      },
      offsetX: {
        default: null,
        parseHTML: (el) => {
          const v = el.getAttribute('data-offset-x');
          return v == null ? null : parseFloat(v);
        },
        renderHTML: (attrs) =>
          attrs.offsetX != null ? { 'data-offset-x': attrs.offsetX } : {},
      },
      offsetY: {
        default: null,
        parseHTML: (el) => {
          const v = el.getAttribute('data-offset-y');
          return v == null ? null : parseFloat(v);
        },
        renderHTML: (attrs) =>
          attrs.offsetY != null ? { 'data-offset-y': attrs.offsetY } : {},
      },
    };
  },

  addCommands() {
    // Delegates to the built-in updateAttributes (so ranges / AllSelection
    // keep working as before), then restores a NodeSelection on the image.
    // Now that the image is inline, ProseMirror's default NodeSelection#map
    // collapses to a TextSelection right after any attribute edit (its
    // parent paragraph has inline content, so Selection.near never re-picks
    // the node) — without this, a second toolbar action right after the
    // first would silently find no image to update.
    const updateImageAttrs = (attrs) => ({ state, tr, dispatch, commands }) => {
      const { selection } = state;
      const wasNodeSelected =
        selection instanceof NodeSelection && selection.node.type.name === this.name;
      const pos = wasNodeSelected ? selection.from : null;
      const applied = commands.updateAttributes(this.name, attrs);
      if (applied && pos != null && dispatch) {
        tr.setSelection(NodeSelection.create(tr.doc, pos));
      }
      return applied;
    };

    return {
      ...this.parent?.(),
      setImageWidth: (width) => updateImageAttrs({ width }),
      setImageAlign: (align) => updateImageAttrs({ align }),
      setImageSize: ({ width, height }) => updateImageAttrs({ width, height }),
      resetImageSize: () => updateImageAttrs({ width: null, height: null }),
      setImageWrap: (wrap) =>
        updateImageAttrs(
          wrap === 'front' || wrap === 'behind'
            ? { wrap }
            : { wrap, offsetX: null, offsetY: null },
        ),
      setImagePosition: ({ offsetX, offsetY }) => updateImageAttrs({ offsetX, offsetY }),
    };
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      let current = node;
      const dom = document.createElement('div');
      dom.className = 'tiptap-image';
      if (current.attrs.align) dom.setAttribute('data-align', current.attrs.align);
      const applyWrap = (attrs) => {
        dom.dataset.wrap = attrs.wrap || 'break';
        if (attrs.wrap === 'front' || attrs.wrap === 'behind') {
          dom.style.left = attrs.offsetX != null ? `${attrs.offsetX}px` : '';
          dom.style.top = attrs.offsetY != null ? `${attrs.offsetY}px` : '';
        } else {
          dom.style.left = '';
          dom.style.top = '';
        }
      };
      applyWrap(current.attrs);

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
      let moveCleanup = null;
      const startMove = (e) => {
        if (current.attrs.wrap !== 'front' && current.attrs.wrap !== 'behind') return;
        e.preventDefault();
        if (typeof getPos === 'function') editor.commands.setNodeSelection(getPos());
        const startX = e.clientX;
        const startY = e.clientY;
        const startLeft = dom.style.left ? parseFloat(dom.style.left) : dom.offsetLeft;
        const startTop = dom.style.top ? parseFloat(dom.style.top) : dom.offsetTop;
        const sheet = dom.closest('.editor-sheet');
        let moved = false;
        const onMove = (ev) => {
          moved = true;
          let nx = startLeft + (ev.clientX - startX);
          let ny = startTop + (ev.clientY - startY);
          if (sheet) {
            const maxX = Math.max(0, sheet.clientWidth - dom.offsetWidth);
            const maxY = Math.max(0, sheet.clientHeight - dom.offsetHeight);
            nx = Math.max(0, Math.min(nx, maxX));
            ny = Math.max(0, Math.min(ny, maxY));
          }
          dom.style.left = `${Math.round(nx)}px`;
          dom.style.top = `${Math.round(ny)}px`;
        };
        const onUp = () => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          moveCleanup = null;
          if (moved && typeof getPos === 'function') {
            const pos = getPos();
            const offsetX = parseFloat(dom.style.left) || 0;
            const offsetY = parseFloat(dom.style.top) || 0;
            editor
              .chain()
              .command(({ tr, state }) => {
                const attrs = state.doc.nodeAt(pos)?.attrs ?? current.attrs;
                tr.setNodeMarkup(pos, undefined, { ...attrs, offsetX, offsetY });
                tr.setSelection(NodeSelection.create(tr.doc, pos));
                return true;
              })
              .run();
          }
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        moveCleanup = () => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
        };
      };
      dom.addEventListener('pointerdown', startMove);
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
            const dwFromX = west ? -dx : dx;
            const dhFromY = north ? -dy : dy;
            // Aspect-locked: follow whichever axis the pointer moved further along.
            const delta =
              Math.abs(dwFromX) > Math.abs(dhFromY) ? dwFromX : dhFromY * ratio;
            w = Math.max(40, Math.min(maxW, startW + delta));
            h = Math.max(40, w / ratio);
          } else if (changesW) {
            w = Math.max(40, Math.min(maxW, startW + (west ? -dx : dx)));
          } else if (changesH) {
            h = Math.max(40, startH + (north ? -dy : dy));
          }
          dom.style.width = `${Math.round(w)}px`;
          if (changesH || isCorner) dom.style.height = `${Math.round(h)}px`;
          // Keep the edge opposite the grabbed handle visually anchored so the
          // grabbed edge tracks the cursor (an in-flow box only grows right/bottom).
          const tx = west ? -(w - startW) : 0;
          const ty = north ? -(h - startH) : 0;
          dom.style.transform = tx || ty ? `translate(${tx}px, ${ty}px)` : '';
          badge.textContent = `${Math.round(w)} × ${Math.round(h)}`;
          badge.style.left = `${ev.clientX + 12}px`;
          badge.style.top = `${ev.clientY + 12}px`;
        };
        const onUp = () => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          badge.remove();
          dom.style.transform = '';
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
                tr.setSelection(NodeSelection.create(tr.doc, pos));
                return true;
              })
              .run();
          }
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        // Clean up drag listeners + transient styles if destroyed mid-drag.
        cleanup = () => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          badge.remove();
          dom.style.transform = '';
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
          applyWrap(updated.attrs);
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
          if (moveCleanup) moveCleanup();
        },
      };
    };
  },
});
