// Nested grammars: a text of one language inside a text of another.
//
// A program holds natural language in its comments and strings, a string
// may hold code of another language, and prose may quote code between
// backticks. `nestGrammars` reads each of them with the grammar it is
// written in and keeps the reading next to the text:
//
//   comment 'Prints `x + 1`'
//     prose english
//       sentence
//         word Prints (concept print) (part verb)
//         code javascript
//           ...the statements of x + 1
//
// A string reads as code when the grammar of the program, or else the
// likeliest programming language, reads all of it; otherwise as prose.
//
// The comments a program, a function or an import keeps as a list of
// strings become comment nodes, read the same way.
//
// A long text (more than `longestInlineText` words) is written once, in
// the `texts` of the program, under an id; the comment, and every string
// equal to it, refers to it by that id. The ids follow the texts in the
// order of the field names of the tree. `unnest` puts the texts back and
// drops the readings, so a nested program translates like the plain one.
// The Rust twin is rust/src/nesting.rs.

import { readProse } from '../natural/prose-reading.js';
import { wordsOf } from '../natural/comments.js';

export const longestInlineText = 12;

const codeLike = /[(){}[\];=]/u;

const isNode = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function mapTree(value, visit) {
  if (Array.isArray(value)) {
    return value.map((item) => mapTree(item, visit));
  }
  if (!isNode(value)) {
    return value;
  }
  const mapped = Object.fromEntries(
    Object.entries(value).map(([field, item]) => [field, mapTree(item, visit)])
  );
  return value.kind ? visit(mapped) : mapped;
}

// The texts of a node: a comment's text, a string's value.
const textField = { Comment: 'text', Text: 'value' };

// The fields that hold the comments of a program, a function or an import
// as plain strings; the nested program holds them as comment nodes.
const commentLists = ['comments', 'mainComments'];

const filled = (text) => typeof text === 'string' && text.trim() !== '';

const textOf = (current) => {
  const field = textField[current.kind];
  const text = field && current[field];
  return filled(text) ? text : undefined;
};

// The texts of a tree, its fields taken in the order of their names (the
// order the Rust twin keeps them in), so both number the long texts alike.
function textsOf(value, found = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => textsOf(item, found));
  } else if (isNode(value)) {
    const text = textOf(value);
    if (text !== undefined) {
      found.push(text);
    }
    for (const field of Object.keys(value).sort()) {
      if (commentLists.includes(field) && Array.isArray(value[field])) {
        found.push(...value[field].filter(filled));
      }
      textsOf(value[field], found);
    }
  }
  return found;
}

// A node with its comment lists changed item by item.
function withCommentLists(current, change) {
  const lists = commentLists.filter((field) => Array.isArray(current[field]));
  return lists.length
    ? {
        ...current,
        ...Object.fromEntries(
          lists.map((field) => [field, current[field].map(change)])
        ),
      }
    : current;
}

// Read the comments and strings of a meta program with the grammars they
// are written in. `translator` reads code: parseFragment and
// detectLanguage.
export function nestGrammars(program, language, translator) {
  // Quoted code is code; a string is code only when it looks like it.
  const readCode = (text, quoted = true) => {
    if (!quoted && !codeLike.test(text)) {
      return undefined;
    }
    const candidates = [
      language,
      ...translator
        .detectLanguage(text, { limit: 3 })
        .filter((candidate) => !candidate.natural && candidate.reads)
        .map((candidate) => candidate.id),
    ];
    for (const id of new Set(candidates)) {
      try {
        const { program: code } = translator.parseFragment(text, id);
        return { kind: 'Code', language: id, program: code };
      } catch {
        // The next language may read it.
      }
    }
    return undefined;
  };
  const reading = (text, kind) =>
    (kind === 'Text' ? readCode(text, false) : undefined) ??
    readProse(text, { readCode });

  const texts = [];
  const idOf = (text) => {
    let known = texts.find((entry) => entry.text === text);
    if (!known) {
      known = {
        kind: 'Paragraph',
        id: `text-${texts.length + 1}`,
        text,
        reading: reading(text, 'Comment'),
      };
      texts.push(known);
    }
    return known.id;
  };
  const long = (text) => wordsOf(text).length > longestInlineText;
  textsOf(program).filter(long).forEach(idOf);
  const nestText = (current) => {
    const text = textOf(current);
    if (text === undefined) {
      return current;
    }
    if (long(text)) {
      const field = textField[current.kind];
      const rest = Object.fromEntries(
        Object.entries(current).filter(([name]) => name !== field)
      );
      return { ...rest, reference: idOf(text) };
    }
    const found = reading(text, current.kind);
    return found ? { ...current, reading: found } : current;
  };
  const nested = mapTree(program, (current) =>
    nestText(
      withCommentLists(current, (item) =>
        filled(item) ? nestText({ kind: 'Comment', text: item }) : item
      )
    )
  );
  return texts.length && nested.kind === 'Program'
    ? { ...nested, texts }
    : nested;
}

// The plain program of a nested one: every text in its place, no readings.
export function unnest(program) {
  const texts = new Map(
    (program?.texts ?? []).map((entry) => [entry.id, entry.text])
  );
  const plain = mapTree(program, (current) => {
    const field = textField[current.kind];
    const kept = Object.fromEntries(
      Object.entries(current).filter(
        ([name]) => name !== 'reading' && name !== 'reference'
      )
    );
    const restored =
      field && current.reference !== undefined
        ? { ...kept, [field]: texts.get(current.reference) }
        : kept;
    return withCommentLists(restored, (item) =>
      item?.kind === 'Comment' ? item.text : item
    );
  });
  if (plain?.kind === 'Program' && plain.texts) {
    return Object.fromEntries(
      Object.entries(plain).filter(([name]) => name !== 'texts')
    );
  }
  return plain;
}
