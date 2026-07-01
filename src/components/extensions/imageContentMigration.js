// Existing documents stored images as top-level (block) nodes. The image node
// is now inline, so a top-level image is schema-invalid — wrap each in a
// paragraph on load. Pure + idempotent; never mutates the stored JSON.
export function migrateImageContent(doc) {
  if (!doc || !Array.isArray(doc.content)) return doc;
  return {
    ...doc,
    content: doc.content.map((node) =>
      node && node.type === 'image'
        ? { type: 'paragraph', content: [node] }
        : node
    ),
  };
}
