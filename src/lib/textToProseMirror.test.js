import { textToProseMirrorDoc } from './textToProseMirror';

test('wraps each line in a paragraph', () => {
  expect(textToProseMirrorDoc('Hello\nWorld')).toEqual({
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'World' }] },
    ],
  });
});

test('blank lines become empty paragraphs', () => {
  expect(textToProseMirrorDoc('A\n\nB').content).toEqual([
    { type: 'paragraph', content: [{ type: 'text', text: 'A' }] },
    { type: 'paragraph' },
    { type: 'paragraph', content: [{ type: 'text', text: 'B' }] },
  ]);
});

test('empty or nullish input yields a single empty paragraph', () => {
  const empty = { type: 'doc', content: [{ type: 'paragraph' }] };
  expect(textToProseMirrorDoc('')).toEqual(empty);
  expect(textToProseMirrorDoc(null)).toEqual(empty);
  expect(textToProseMirrorDoc(undefined)).toEqual(empty);
});
