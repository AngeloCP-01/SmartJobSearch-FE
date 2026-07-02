// Existing documents stored images as block nodes — as direct children of `doc`
// and, because the old image node was block-group, of any block container (table
// cell, list item, blockquote). The image node is now inline, so any image that
// is a direct child of a block container is schema-invalid — wrap each in a
// paragraph on load. Images already inside a text block (paragraph/heading) are
// legitimately inline and left alone. Pure + idempotent; never mutates the input.
const TEXT_BLOCK_TYPES = new Set(['paragraph', 'heading']);

export function migrateImageContent(node) {
  if (!node || typeof node !== 'object' || !Array.isArray(node.content)) return node;
  const parentIsTextBlock = TEXT_BLOCK_TYPES.has(node.type);
  return {
    ...node,
    content: node.content.map((child) => {
      const migrated = migrateImageContent(child);
      return !parentIsTextBlock && migrated && migrated.type === 'image'
        ? { type: 'paragraph', content: [migrated] }
        : migrated;
    }),
  };
}
