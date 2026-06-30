import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { FindReplace, searchKey } from './findReplace';

function makeEditor(html) {
  return new Editor({
    element: document.createElement('div'),
    extensions: [StarterKit, FindReplace],
    content: html || '<p>the cat sat on the mat, the cat ran with a dog</p>',
  });
}
const st = (editor) => searchKey.getState(editor.state);

test('setSearchTerm finds all case-insensitive matches', () => {
  const editor = makeEditor();
  editor.commands.setSearchTerm('the');
  expect(st(editor).matches.length).toBe(3);
  editor.destroy();
});

test('case sensitivity narrows matches', () => {
  const editor = makeEditor('<p>The the THE</p>');
  editor.commands.setSearchTerm('the');
  expect(st(editor).matches.length).toBe(3);
  editor.commands.setCaseSensitive(true);
  expect(st(editor).matches.length).toBe(1);
  editor.destroy();
});

test('findNext and findPrev move and wrap the active index', () => {
  const editor = makeEditor();
  editor.commands.setSearchTerm('the');
  expect(st(editor).activeIndex).toBe(0);
  editor.commands.findNext();
  expect(st(editor).activeIndex).toBe(1);
  editor.commands.findPrev();
  editor.commands.findPrev();
  expect(st(editor).activeIndex).toBe(2); // wrapped from 0 → 2
  editor.destroy();
});

test('replaceCurrent replaces only the active match', () => {
  const editor = makeEditor('<p>cat cat cat</p>');
  editor.commands.setSearchTerm('cat');
  editor.commands.setReplaceTerm('dog');
  editor.commands.replaceCurrent();
  expect(editor.getText()).toBe('dog cat cat');
  editor.destroy();
});

test('replaceAll replaces every match in one undo step', () => {
  const editor = makeEditor('<p>cat cat cat</p>');
  editor.commands.setSearchTerm('cat');
  editor.commands.setReplaceTerm('dog');
  editor.commands.replaceAll();
  expect(editor.getText()).toBe('dog dog dog');
  editor.commands.undo();
  expect(editor.getText()).toBe('cat cat cat');
  editor.destroy();
});

test('clearSearch empties the matches', () => {
  const editor = makeEditor();
  editor.commands.setSearchTerm('the');
  editor.commands.clearSearch();
  expect(st(editor).matches.length).toBe(0);
  editor.destroy();
});
