// Split one controlled sentence (or one template) into tokens.
//
//   word       a run of letters, marks, digits and "_"; "-", "'" and the
//              language's name joiner may join such runs into one word
//   number     an integer, optionally negative ("-5")
//   text       a quoted literal, in the language's own quotation marks;
//              a doubled closing mark stands for the mark itself
//   open/close parentheses (ASCII or full width)
//   separator  the language's list separator (or an ASCII comma)
//   slot       "{name}", only inside templates

// Zero-width (non-)joiners belong to words, as in Persian "می\u200cشود".
const letter = /[\p{L}\p{M}\p{N}\u200c\u200d]/u;
const digit = /[0-9]/;
const openings = new Set(['(', '（']);
const closings = new Set([')', '）']);

const fold = (word) => word.toLowerCase();

function readWord(source, start, joiners) {
  let end = start;
  while (end < source.length) {
    const character = source[end];
    if (letter.test(character)) {
      end += 1;
    } else if (
      joiners.has(character) &&
      end > start &&
      end + 1 < source.length &&
      (letter.test(source[end + 1]) || source[end + 1] === '_')
    ) {
      end += 1;
    } else if (character === '_') {
      end += 1;
    } else {
      break;
    }
  }
  return end;
}

function readText(source, start, closing) {
  let value = '';
  let index = start;
  while (index < source.length) {
    if (source.startsWith(closing, index)) {
      if (source.startsWith(closing, index + closing.length)) {
        value += closing;
        index += closing.length * 2;
        continue;
      }
      return { value, end: index + closing.length };
    }
    value += source[index];
    index += 1;
  }
  throw new Error(`Unclosed quotation in "${source}"`);
}

const operandEnd = (token) =>
  token &&
  (token.type === 'number' || token.type === 'text' || token.type === 'close');

function readNumber(source, index) {
  let end = index + 1;
  while (end < source.length && digit.test(source[end])) {
    end += 1;
  }
  return {
    token: { type: 'number', value: Number(source.slice(index, end)) },
    end,
  };
}

const startsNumber = (source, index, previous) =>
  digit.test(source[index]) ||
  (source[index] === '-' &&
    digit.test(source[index + 1] ?? '') &&
    !operandEnd(previous));

// The token starting at `index`, or undefined for white space.
function readToken(source, index, context) {
  const character = source[index];
  const { opening, closing, separators, joiners, templates, previous } =
    context;
  if (templates && character === '{') {
    const end = source.indexOf('}', index);
    return {
      token: { type: 'slot', value: source.slice(index + 1, end) },
      end: end + 1,
    };
  }
  if (source.startsWith(opening, index)) {
    const { value, end } = readText(source, index + opening.length, closing);
    return { token: { type: 'text', value }, end };
  }
  if (startsNumber(source, index, previous)) {
    return readNumber(source, index);
  }
  if (openings.has(character) || closings.has(character)) {
    const type = openings.has(character) ? 'open' : 'close';
    return {
      token: { type, value: type === 'open' ? '(' : ')' },
      end: index + 1,
    };
  }
  if (separators.has(character)) {
    return { token: { type: 'separator', value: character }, end: index + 1 };
  }
  if (letter.test(character) || character === '_') {
    const end = readWord(source, index, joiners);
    const value = source.slice(index, end);
    return { token: { type: 'word', value, folded: fold(value) }, end };
  }
  // Any other mark (for example "!" or "=") is a word of its own.
  return {
    token: { type: 'word', value: character, folded: character },
    end: index + 1,
  };
}

export function tokenize(source, language, { templates = false } = {}) {
  const [opening, closing] = language.quotes ?? ['"', '"'];
  const context = {
    opening,
    closing,
    templates,
    separators: new Set([language.listSeparator ?? ',', ',']),
    joiners: new Set(['-', "'", '’', language.nameJoiner ?? '-']),
  };
  const tokens = [];
  let index = 0;
  while (index < source.length) {
    if (/\s/u.test(source[index])) {
      index += 1;
      continue;
    }
    const { token, end } = readToken(source, index, {
      ...context,
      previous: tokens.at(-1),
    });
    tokens.push(token);
    index = end;
  }
  return tokens;
}

export const foldWord = fold;
