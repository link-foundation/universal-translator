// Syntax highlighting taken from the meta language, with no grammar of
// each language. A text is read into a meta program by the
// translator; the words that program keeps as names of variables or
// functions are coloured as such, its texts and numbers as values, and
// every other word of the text is spelled by the language itself (a
// keyword of Python, a word of an English sentence such as "Define" or
// "using"), so it is a keyword. The comment markers and quotes come from
// the description of the language (lineComment, blockComment, quotes; the
// note template and quotes of a natural language).
//
// The meta view and the rules are indented Links Notation: there the first
// word of a line is the kind of a meta node, "name:" a unique name, and
// (field value) links are fields.
//
// highlightLine(line, state, lexicon) -> { tokens: [{ from, type }], state }
// colours one line, the way Monaco asks for it; highlightText does a whole
// text. Types: keyword, variable, function, string, number, comment,
// delimiter, attribute, type and '' (plain).

import { writeName } from '../../../js/src/natural/writer.js';

const kebab = (word) =>
  word
    .replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, '$1-$2')
    .replace(/_/gu, '-')
    .toLowerCase();

const wordPattern = /^[\p{L}_$][\p{L}\p{M}\p{N}_$]*/u;
const numberPattern = /^\d[\d_]*(\.\d+)?([eE][+-]?\d+)?/u;
const spacePattern = /^\s+/u;

// The names, functions and kinds a meta program keeps.
export function metaWords(program) {
  const names = new Set();
  const functions = new Set();
  const visit = (node, list) => {
    if (Array.isArray(node)) {
      node.forEach((item) => visit(item, list));
      return;
    }
    if (!node || typeof node !== 'object') {
      return;
    }
    const add = (set, value) => {
      if (typeof value === 'string') {
        // "my value", "myValue" and "my_value" are one name: my-value.
        set.add(kebab(value.trim()).replace(/\s+/gu, '-'));
      }
    };
    if (node.kind === 'Function' || node.kind === 'Call') {
      // A method (System.out.println) is coloured at its last word.
      add(functions, (node.name ?? node.callee)?.split?.('.').at(-1));
    }
    if (
      ['Name', 'Declaration', 'Assignment', 'IndexAssignment'].includes(
        node.kind
      ) ||
      list === 'parameters'
    ) {
      add(names, node.name);
    }
    if (node.kind === 'CountingLoop') {
      add(names, node.variable);
    }
    for (const [field, value] of Object.entries(node)) {
      if (value && typeof value === 'object') {
        visit(value, field);
      }
    }
  };
  visit(program);
  return { names, functions };
}

// What a language writes: comment markers and quotes. `syntax` is the
// description of a programming language (languageSyntax) or of a natural
// one (naturalLanguage); words come from metaWords.
export function sourceLexicon(syntax = {}, words = {}) {
  const natural = Boolean(syntax.templates);
  const names = words.names ?? new Set();
  const functions = words.functions ?? new Set();
  return {
    kind: 'source',
    ...(natural ? naturalMarks(syntax) : formalMarks(syntax)),
    names,
    functions,
    phrases: natural ? writtenNames(syntax, names, functions) : [],
  };
}

// A natural language writes a name in its own words ("first" is "birinci"
// in Turkish, "gcd-of" is "gcd-из" in Russian): the written forms, the
// longest first, so that a name of several words is one piece.
function writtenNames(language, names, functions) {
  const spell = (name) => {
    try {
      return writeName(name, language).toLowerCase();
    } catch {
      return name;
    }
  };
  return [
    ...[...functions].map((name) => ({ text: spell(name), type: 'function' })),
    ...[...names].map((name) => ({ text: spell(name), type: 'variable' })),
  ]
    .filter(({ text }) => text)
    .sort((a, b) => b.text.length - a.text.length);
}

const letter = /[\p{L}\p{M}\p{N}_]/u;

// The written name that starts at `at`, as a whole word.
function phraseAt(line, at, lexicon) {
  if (at > 0 && letter.test(line[at - 1])) {
    return undefined;
  }
  return lexicon.phrases?.find(
    ({ text }) =>
      line.slice(at, at + text.length).toLowerCase() === text &&
      !letter.test(line[at + text.length] ?? '')
  );
}

// A natural language quotes with its own marks (and "…"); a note, its
// comment, starts with a word such as "Note:".
function naturalMarks({ quotes = ['“', '”'], note = '' }) {
  return {
    lineComments: [note.split('{text}')[0].trim()].filter(Boolean),
    quotes: [quotes, ['"', '"']],
    doubled: false,
  };
}

function formalMarks({ lineComment, blockComment, quotes, doubledQuotes }) {
  return {
    lineComments: [lineComment].filter(Boolean),
    blockComment,
    quotes: (quotes ?? ['"', "'"]).map((quote) => [quote, quote]),
    doubled: Boolean(doubledQuotes),
  };
}

export const linoLexicon = { kind: 'lino' };

const startsWith = (line, at, text) =>
  Boolean(text) && line.startsWith(text, at);

// The rest of a quoted text or a block comment from `at`: where it ends on
// this line, or -1 when it goes on.
function closeAt(line, at, close, { escapes = true, doubled = false } = {}) {
  for (let index = at; index < line.length; index += 1) {
    if (escapes && line[index] === '\\') {
      index += 1;
    } else if (line.startsWith(close, index)) {
      if (doubled && line.startsWith(close, index + close.length)) {
        index += close.length;
        continue;
      }
      return index + close.length;
    }
  }
  return -1;
}

// The meta program knows every function a text defines or calls (a call
// of print is a Call of "print"), so a word before "(" that it does not
// know, such as "if", is a keyword.
function wordType(word, lexicon) {
  const key = kebab(word);
  if (lexicon.functions.has(key)) {
    return 'function';
  }
  return lexicon.names.has(key) ? 'variable' : 'keyword';
}

function sourceLine(line, state, lexicon) {
  const tokens = [];
  let at = 0;
  const push = (type) => {
    if (tokens.at(-1)?.type !== type) {
      tokens.push({ from: at, type });
    }
  };
  if (state.inside) {
    const { close, type, escapes, doubled } = state.inside;
    push(type);
    const end = closeAt(line, 0, close, { escapes, doubled });
    if (end === -1) {
      return { tokens, state };
    }
    at = end;
    state = { inside: null };
  }
  while (at < line.length) {
    const rest = line.slice(at);
    const lineComment = lexicon.lineComments.find((marker) =>
      startsWith(line, at, marker)
    );
    const [open, close] = lexicon.blockComment ?? [];
    const quote = lexicon.quotes.find(([start]) => startsWith(line, at, start));
    const phrase = phraseAt(line, at, lexicon);
    if (startsWith(line, at, open)) {
      push('comment');
      const end = closeAt(line, at + open.length, close, { escapes: false });
      if (end === -1) {
        return {
          tokens,
          state: { inside: { close, type: 'comment', escapes: false } },
        };
      }
      at = end;
    } else if (lineComment) {
      push('comment');
      return { tokens, state };
    } else if (quote) {
      push('string');
      const options = {
        escapes: !lexicon.doubled,
        doubled: lexicon.doubled,
      };
      const end = closeAt(line, at + quote[0].length, quote[1], options);
      if (end === -1) {
        return {
          tokens,
          state: { inside: { close: quote[1], type: 'string', ...options } },
        };
      }
      at = end;
    } else if (phrase) {
      push(phrase.type);
      at += phrase.text.length;
    } else if (spacePattern.test(rest)) {
      at += rest.match(spacePattern)[0].length;
    } else if (numberPattern.test(rest)) {
      push('number');
      at += rest.match(numberPattern)[0].length;
    } else if (wordPattern.test(rest)) {
      const [word] = rest.match(wordPattern);
      push(wordType(word, lexicon));
      at += word.length;
    } else {
      push('delimiter');
      at += 1;
    }
  }
  return { tokens, state };
}

// The kinds whose main value names a variable or a function.
const linoNames = new Set([
  'name',
  'declaration',
  'assignment',
  'index-assignment',
  'parameter',
  'counting-loop',
]);
const linoFunctions = new Set(['function', 'call']);

const linoWord = /^[^\s()'":]+/u;

// A word of Links Notation: "name:" defines a name, (field …) starts with a
// field, the first word of a line is the kind of a meta node and the word
// after it is its main value.
function linoWordType(word, { after, opensLink, first, depth, kind }) {
  if (after === ':') {
    return 'type';
  }
  if (opensLink) {
    return 'attribute';
  }
  if (/^-?\d/u.test(word)) {
    return 'number';
  }
  if (depth !== 0) {
    return '';
  }
  if (first) {
    return 'keyword';
  }
  if (linoFunctions.has(kind)) {
    return 'function';
  }
  if (linoNames.has(kind)) {
    return 'variable';
  }
  return kind === 'text' ? 'string' : '';
}

const nesting = { '(': 1, ')': -1 };

// Links Notation doubles a quote inside a quoted text.
const linoQuoteEnd = (line, at, close) =>
  closeAt(line, at, close, { escapes: false, doubled: true });

function linoLine(line, state) {
  const tokens = [];
  let at = 0;
  let depth = 0;
  let first = true;
  let kind;
  const push = (type) => {
    if (tokens.at(-1)?.type !== type) {
      tokens.push({ from: at, type });
    }
  };
  if (state.inside) {
    push('string');
    at = linoQuoteEnd(line, 0, state.inside.close);
    if (at === -1) {
      return { tokens, state };
    }
    first = false;
    state = { inside: null };
  }
  while (at < line.length) {
    const rest = line.slice(at);
    const char = line[at];
    if (spacePattern.test(rest)) {
      at += rest.match(spacePattern)[0].length;
    } else if ('():'.includes(char)) {
      push('delimiter');
      depth += nesting[char] ?? 0;
      at += 1;
    } else if ('\'"`'.includes(char)) {
      push('string');
      const end = linoQuoteEnd(line, at + 1, char);
      if (end === -1) {
        return { tokens, state: { inside: { close: char } } };
      }
      at = end;
      first = false;
    } else {
      const [word] = rest.match(linoWord);
      const type = linoWordType(word, {
        after: line[at + word.length],
        opensLink: line[at - 1] === '(',
        first,
        depth,
        kind,
      });
      kind = first && type === 'keyword' ? word : kind;
      push(type);
      at += word.length;
      first = false;
    }
  }
  return { tokens, state };
}

export const initialState = () => ({ inside: null });

export function highlightLine(line, state, lexicon) {
  return lexicon.kind === 'lino'
    ? linoLine(line, state)
    : sourceLine(line, state, lexicon);
}

// The tokens of every line of a text.
export function highlightText(text, lexicon) {
  let state = initialState();
  return text.split('\n').map((line) => {
    const result = highlightLine(line, state, lexicon);
    state = result.state;
    return result.tokens;
  });
}

// One line as [text, type] pieces, for tests and debugging.
// The text before the first token (the indentation) is a plain piece.
export function pieces(line, tokens) {
  const all =
    (tokens[0]?.from ?? line.length) > 0
      ? [{ from: 0, type: '' }, ...tokens]
      : tokens;
  return all.map(({ from, type }, index) => [
    line.slice(from, all[index + 1]?.from ?? line.length),
    type,
  ]);
}
