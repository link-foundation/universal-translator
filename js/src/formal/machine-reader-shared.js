// Helpers shared by the machine code readers (machine-reader.js and the
// dialect readers next to it).

import {
  combineOrigins,
  trackComments,
  sourceOrigin,
  withOrigin,
} from '../translation/source-origins.js';
import { linesOrigin } from './machine-source.js';
export { sourceLines } from './machine-source.js';

export const relationsByJump = (table) =>
  Object.fromEntries(Object.entries(table).map(([key, value]) => [value, key]));

export function readError(target, line, message) {
  return new Error(`Cannot read ${target} line "${line}": ${message}`);
}

// A pattern that matches a whole line exactly.
export const exact = (line) =>
  new RegExp(`^${line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);

// Read instructions with a list of rules. A rule is [patterns, build]: the
// patterns match consecutive lines, and build turns the matches into
// instructions. The first rule that matches wins, so longer sequences come
// first.
export function readInstructions(lines, rules, target) {
  const code = [];
  let index = 0;
  while (index < lines.length) {
    let matched = false;
    for (const [patterns, build] of rules) {
      const matches = patterns.map((pattern, offset) =>
        lines[index + offset]?.match(pattern)
      );
      if (matches.every(Boolean)) {
        const built = build(...matches);
        if (built) {
          const origin = linesOrigin(lines, index, patterns.length);
          code.push(
            ...built.map((instruction) => withOrigin(instruction, origin))
          );
          index += patterns.length;
          matched = true;
          break;
        }
      }
    }
    if (!matched) {
      throw readError(target, lines[index], 'unknown instruction');
    }
  }
  return code;
}

// Split a file into the program comments (before the first line that
// starts the program) and the rest.
export function leadingComments(lines, prefix, start) {
  const first = lines.findIndex((line) => start.test(line));
  const comments = lines
    .slice(0, Math.max(first, 0))
    .filter((line) => line.startsWith(prefix))
    .map((line) => line.slice(prefix.length).replace(/^ /, ''));
  trackComments(
    comments,
    comments.map((_, index) => linesOrigin(comments, index))
  );
  return { comments, rest: lines.slice(first) };
}

export const integer = (text) => {
  const value = Number(text);
  if (!Number.isSafeInteger(value)) {
    throw new Error(`The integer ${text} is outside the supported range`);
  }
  return value;
};

// Functions after reading: "main" is the entry point.
export function program(comments, items) {
  const main = items.find((item) => item.name === 'main');
  if (!main) {
    throw new Error('The machine program has no entry point');
  }
  return {
    comments,
    functions: items.filter((item) => item !== main),
    main,
  };
}

// "call f" followed by the instruction that pushes the result keeps the
// result of f; the rules read that instruction as ['result']. A call without
// it is a call to a function that returns nothing.
export function resolveResults(raw, target, line) {
  const code = [];
  for (const instruction of raw) {
    if (instruction[0] !== 'result') {
      code.push(instruction);
    } else if (code.at(-1)?.[0] !== 'call') {
      throw readError(target, line, 'not after a call');
    } else {
      withOrigin(
        code.at(-1),
        combineOrigins([sourceOrigin(code.at(-1)), sourceOrigin(instruction)])
      );
    }
  }
  return code;
}

// The text that bytes spell.
export const decodeBytes = (bytes) =>
  new globalThis.TextDecoder().decode(Uint8Array.from(bytes));
