// The common library route from issue 1. Every language has a small library
// in `common-library/` with the same four output operations. This layer
// replaces print statements with calls to those operations. A translation
// that uses it is nearly line for line, because each language only has to
// spell a call. `recognizeCommonLibrary` does the reverse, so a program
// that calls the library can be translated to any language.
//
// The library only smooths over standard-library differences: it writes
// text, integers and newlines, and it has no algorithms.

import { languageSyntax, namingConvention } from './languages.js';
import { nameWords, spellName } from './names.js';
import { node, rewrite } from './meta.js';

// Neutral names of the operations, as the meta language stores names.
export const commonLibraryOperations = [
  'print-line',
  'write-text',
  'write-integer',
  'end-line',
];

// How each language reaches the library: the lines that make it available
// and the prefix of each call.
export const commonLibraryAccess = {
  javascript: {
    imports: (names) => [
      `import { ${names.join(', ')} } from './common-library.mjs';`,
    ],
  },
  typescript: {
    imports: (names) => [
      `import { ${names.join(', ')} } from './common-library.ts';`,
    ],
  },
  python: {
    imports: (names) => [`from common_library import ${names.join(', ')}`],
  },
  ruby: { imports: () => ['require_relative "common_library"'] },
  lua: {
    imports: () => ['local common_library = require("common_library")'],
    prefix: 'common_library.',
  },
  php: { imports: () => ["require_once 'common_library.php';"] },
  c: { imports: () => ['#include "common_library.h"'] },
  cpp: { imports: () => ['#include "common_library.hpp"'] },
  csharp: { prefix: 'CommonLibrary.' },
  java: { prefix: 'CommonLibrary.' },
  go: {},
  rust: {
    imports: (names) => [
      'mod common_library;',
      `use common_library::{${names.join(', ')}};`,
    ],
  },
  kotlin: {},
  swift: {},
};

const call = (operation, argument) =>
  node('Evaluate', {
    expression: node('Call', {
      callee: operation,
      arguments: argument ? [argument] : [],
      library: 'common',
      type: 'nothing',
    }),
  });

// One print statement becomes one or more library calls.
function libraryCalls({ value, newline }) {
  const parts = value.kind === 'Interpolation' ? value.parts : [value];
  if (newline && parts.length === 1 && parts[0].type === 'text') {
    return [call('print-line', parts[0])];
  }
  const calls = parts.map((part) => {
    if (part.type === 'text') {
      return call('write-text', part);
    }
    if (part.type === 'integer') {
      return call('write-integer', part);
    }
    throw new Error(
      `The common library cannot write a ${part.type ?? 'untyped'} value`
    );
  });
  return newline ? [...calls, call('end-line')] : calls;
}

// Meta layer: replace every print statement with common library calls.
export function useCommonLibrary(program) {
  const replaced = rewrite(program, (current) =>
    current.kind === 'Block'
      ? {
          ...current,
          statements: current.statements.flatMap((statement) =>
            statement.kind === 'Print' ? libraryCalls(statement) : [statement]
          ),
        }
      : current
  );
  return { ...replaced, libraries: ['common'] };
}

// Understanding rule: a call to a library operation, however the source
// spells and qualifies it, is a print statement again.
export function recognizeCommonLibrary(program) {
  return rewrite(program, (current) => {
    const expression = current.expression;
    if (current.kind !== 'Evaluate' || expression?.kind !== 'Call') {
      return current;
    }
    const operation = nameWords(expression.callee.split(/\.|::/).at(-1)).join(
      '-'
    );
    const [argument] = expression.arguments;
    switch (operation) {
      case 'print-line':
        return node('Print', { value: argument, newline: true });
      case 'write-text':
      case 'write-integer':
        return node('Print', { value: argument, newline: false });
      case 'end-line':
        return node('Print', {
          value: node('Text', { value: '' }),
          newline: true,
        });
      default:
        return current;
    }
  });
}

// Context rule: spell each library call for the target language and list
// the lines that make the library available.
export function spellCommonLibrary(program, { to }) {
  if (!program.libraries?.includes('common')) {
    return program;
  }
  const access = commonLibraryAccess[to];
  if (!access) {
    throw new Error(`The common library has no ${to} implementation`);
  }
  const convention = namingConvention(languageSyntax(to), 'function');
  const used = new Set();
  const spelled = rewrite(program, (current) => {
    if (current.kind !== 'Call' || current.library !== 'common') {
      return current;
    }
    const spelling = spellName(current.callee, convention);
    used.add(spelling);
    return { ...current, callee: `${access.prefix ?? ''}${spelling}` };
  });
  return { ...spelled, libraryImports: access.imports?.([...used]) ?? [] };
}
