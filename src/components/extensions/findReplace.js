import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export const searchKey = new PluginKey('findReplace');

// Build a flat text string for the doc with a position map back to PM positions.
// A newline separator between blocks prevents matches from crossing block bounds
// and gives each separator a stable anchor position.
function buildIndex(doc) {
  let text = '';
  const map = [];
  doc.descendants((node, pos) => {
    if (node.isText) {
      for (let i = 0; i < node.text.length; i += 1) {
        text += node.text[i];
        map.push(pos + i);
      }
    } else if (node.isBlock && text.length > 0 && text[text.length - 1] !== '\n') {
      text += '\n';
      map.push(pos);
    }
  });
  return { text, map };
}

function findMatches(doc, term, caseSensitive) {
  if (!term) return [];
  const { text, map } = buildIndex(doc);
  const haystack = caseSensitive ? text : text.toLowerCase();
  const needle = caseSensitive ? term : term.toLowerCase();
  const matches = [];
  let idx = haystack.indexOf(needle);
  while (idx !== -1) {
    const from = map[idx];
    const to = map[idx + needle.length - 1] + 1;
    matches.push({ from, to });
    idx = haystack.indexOf(needle, idx + needle.length);
  }
  return matches;
}

const INITIAL = {
  searchTerm: '',
  replaceTerm: '',
  caseSensitive: false,
  matches: [],
  activeIndex: 0,
  decorations: DecorationSet.empty,
};

export const FindReplace = Extension.create({
  name: 'findReplace',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: searchKey,
        state: {
          init: () => ({ ...INITIAL }),
          apply(tr, value, _oldState, newState) {
            const meta = tr.getMeta(searchKey);
            let next = meta ? { ...value, ...meta } : value;
            if (meta || tr.docChanged) {
              const matches = findMatches(newState.doc, next.searchTerm, next.caseSensitive);
              const activeIndex = matches.length ? Math.min(next.activeIndex, matches.length - 1) : 0;
              const decorations = matches.length
                ? DecorationSet.create(
                    newState.doc,
                    matches.map((m, i) =>
                      Decoration.inline(m.from, m.to, {
                        class: i === activeIndex ? 'search-match search-match--active' : 'search-match',
                      }),
                    ),
                  )
                : DecorationSet.empty;
              next = { ...next, matches, activeIndex, decorations };
            } else if (value.decorations !== DecorationSet.empty) {
              next = { ...next, decorations: value.decorations.map(tr.mapping, tr.doc) };
            }
            return next;
          },
        },
        props: {
          decorations(state) {
            return searchKey.getState(state).decorations;
          },
        },
      }),
    ];
  },

  addCommands() {
    const setMeta = (patch) => ({ state, dispatch }) => {
      if (dispatch) dispatch(state.tr.setMeta(searchKey, patch));
      return true;
    };
    const gotoIndex = (compute) => ({ state, dispatch }) => {
      const s = searchKey.getState(state);
      if (!s.matches.length) return false;
      const activeIndex = compute(s.activeIndex, s.matches.length);
      if (dispatch) {
        const m = s.matches[activeIndex];
        const tr = state.tr.setMeta(searchKey, { activeIndex });
        tr.setSelection(TextSelection.create(tr.doc, m.from, m.to)).scrollIntoView();
        dispatch(tr);
      }
      return true;
    };
    return {
      setSearchTerm: (term) => setMeta({ searchTerm: term, activeIndex: 0 }),
      setReplaceTerm: (term) => setMeta({ replaceTerm: term }),
      setCaseSensitive: (caseSensitive) => setMeta({ caseSensitive, activeIndex: 0 }),
      clearSearch: () => setMeta({ searchTerm: '', replaceTerm: '', caseSensitive: false, matches: [], activeIndex: 0 }),
      findNext: () => gotoIndex((i, n) => (i + 1) % n),
      findPrev: () => gotoIndex((i, n) => (i - 1 + n) % n),
      replaceCurrent: () => ({ state, dispatch }) => {
        const s = searchKey.getState(state);
        const m = s.matches[s.activeIndex];
        if (!m) return false;
        if (dispatch) dispatch(state.tr.insertText(s.replaceTerm, m.from, m.to));
        return true;
      },
      replaceAll: () => ({ state, dispatch }) => {
        const s = searchKey.getState(state);
        if (!s.matches.length) return false;
        if (dispatch) {
          const tr = state.tr;
          // last → first so earlier positions stay valid as we splice
          [...s.matches].reverse().forEach((m) => tr.insertText(s.replaceTerm, m.from, m.to));
          dispatch(tr);
        }
        return true;
      },
    };
  },
});
