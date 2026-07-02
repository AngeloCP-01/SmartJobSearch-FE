import { NodeSelection } from '@tiptap/pm/state';

// Which column side a drop x falls on.
export function sideForX(clientX, midpointX) {
  return clientX < midpointX ? 'wrap-left' : 'wrap-right';
}

// Move the image node at `fromPos` to `toPos`, merging `attrsPatch` into its
// attributes and selecting it. Returns the transaction, or null if there is no
// image at `fromPos` or the move is a same-position no-op with no attr change.
export function repositionImageNode(state, fromPos, toPos, attrsPatch = {}) {
  const node = state.doc.nodeAt(fromPos);
  if (!node || node.type.name !== 'image') return null;

  let tr = state.tr.delete(fromPos, fromPos + node.nodeSize);
  const insertPos = tr.mapping.map(toPos);
  const patchChanges = Object.keys(attrsPatch).some((k) => node.attrs[k] !== attrsPatch[k]);
  if (insertPos === fromPos && !patchChanges) return null;

  const newNode = node.type.create({ ...node.attrs, ...attrsPatch }, node.content, node.marks);
  tr = tr.insert(insertPos, newNode);
  const created = tr.doc.nodeAt(insertPos);
  if (created && created.type.name === 'image') {
    tr = tr.setSelection(NodeSelection.create(tr.doc, insertPos));
  }
  return tr;
}
