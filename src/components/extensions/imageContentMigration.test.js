import { migrateImageContent } from './imageContentMigration';

test('wraps a top-level image node in a paragraph', () => {
  const doc = {
    type: 'doc',
    content: [
      { type: 'image', attrs: { src: 'http://x/a.png' } },
      { type: 'paragraph', content: [{ type: 'text', text: 'hi' }] },
    ],
  };
  const out = migrateImageContent(doc);
  expect(out.content[0]).toEqual({
    type: 'paragraph',
    content: [{ type: 'image', attrs: { src: 'http://x/a.png' } }],
  });
  expect(out.content[1]).toEqual(doc.content[1]);
});

test('leaves an image already inside a paragraph untouched', () => {
  const doc = {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'image', attrs: { src: 'http://x/a.png' } }] },
    ],
  };
  const out = migrateImageContent(doc);
  expect(out).toEqual(doc);
});

test('is idempotent', () => {
  const doc = {
    type: 'doc',
    content: [{ type: 'image', attrs: { src: 'http://x/a.png' } }],
  };
  const once = migrateImageContent(doc);
  const twice = migrateImageContent(once);
  expect(twice).toEqual(once);
});

test('does not mutate the input', () => {
  const doc = {
    type: 'doc',
    content: [{ type: 'image', attrs: { src: 'http://x/a.png' } }],
  };
  const snapshot = JSON.stringify(doc);
  migrateImageContent(doc);
  expect(JSON.stringify(doc)).toBe(snapshot);
});

test('passes through null/undefined unchanged', () => {
  expect(migrateImageContent(null)).toBeNull();
  expect(migrateImageContent(undefined)).toBeUndefined();
});
