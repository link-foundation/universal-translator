// Syntax highlighting taken from the meta language rather than from a
// grammar of each language. A text is read into a meta program by the
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

const kebab = (word) =>
  word
    .replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, '$1-$2')
    .replace(/_/gu, '-')
    .toLowerCase();

const wordPattern = /^[\p{L}_$][\p{L}\p{N}_$]*/u;
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
        for (const part of value.split(/[\s-]+/u)) {
          set.add(kebab(part));
        }
      }
    };
    if (node.kind === 'Function' || node.kind === 'Call') {
      add(functions, node.name ?? node.callee);
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
  const quotes = natural
    ? [
        [syntax.quotes?.[0] ?? '“', syntax.quotes?.[1] ?? '”'],
        ['"', '"'],
      ]
    : (syntax.quotes ?? ['"', "'"]).map((quote) => [quote, quote]);
  const note = natural ? syntax.note?.split('{text}')[0]?.trim() : undefined;
  const doubled = !natural && Boolean(syntax.doubledQuotes);
  return {
    kind: 'source',
    lineComments: [syntax.lineComment, note].filter(Boolean),
    blockComment: natural ? undefined : syntax.blockComment,
    quotes,
    doubled,
    names: words.names ?? new Set(),
    functions: words.functions ?? new Set(),
  };
}

export const linoLexicon = { kind: 'lino' };

const startsWith = (line, at, text) => Boolean(text) && line.startsWith(text, at);

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

function wordType(word, lexicon, next) {
  const key = kebab(word);
  if (lexicon.functions.has(key)) {
    return 'function';
  }
  if (lexicon.names.has(key)) {
    return 'variable';
  }
  return next === '(' ? 'function' : 'keyword';
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
    } else if (spacePattern.test(rest)) {
      at += rest.match(spacePattern)[0].length;
    } else if (numberPattern.test(rest)) {
      push('number');
      at += rest.match(numberPattern)[0].length;
    } else if (wordPattern.test(rest)) {
      const [word] = rest.match(wordPattern);
      const next = line.slice(at + word.length).trimStart()[0];
      push(wordType(word, lexicon, next));
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
    const end = closeAt(line, 0, state.inside.close, {
      escapes: false,
      doubled: true,
    });
    if (end === -1) {
      return { tokens, state };
    }
    at = end;
    first = false;
    state = { inside: null };
  }
  while (at < line.length) {
    const rest = line.slice(at);
    const char = line[at];
    if (spacePattern.test(rest)) {
      at += rest.match(spacePattern)[0].length;
    } else if (char === '(' || char === ')' || char === ':') {
      push('delimiter');
      depth += char === '(' ? 1 : char === ')' ? -1 : 0;
      at += 1;
    } else if (char === "'" || char === '"' || char === '`') {
      push('string');
      const end = closeAt(line, at + 1, char, { escapes: false, doubled: true });
      if (end === -1) {
        return { tokens, state: { inside: { close: char } } };
      }
      at = end;
      first = false;
    } else {
      const [word] = rest.match(linoWord);
      const after = line[at + word.length];
      const previous = tokens.at(-1);
      let type = '';
      if (after === ':') {
        type = 'type';
      } else if (previous?.type === 'delimiter' && line[at - 1] === '(') {
        type = 'attribute';
      } else if (/^-?\d/u.test(word)) {
        type = 'number';
      } else if (first && depth === 0) {
        type = 'keyword';
        kind = word;
      } else if (depth === 0 && linoFunctions.has(kind)) {
        type = 'function';
      } else if (depth === 0 && linoNames.has(kind)) {
        type = 'variable';
      } else if (depth === 0 && kind === 'text') {
        type = 'string';
      }
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
export function pieces(line, tokens) {
  return tokens.map(({ from, type }, index) => [
    line.slice(from, tokens[index + 1]?.from ?? line.length),
    type,
  ]);
}
