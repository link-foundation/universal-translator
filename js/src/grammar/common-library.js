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
import { partsToValue } from './rules.js';

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

// The lines that make the library available are not part of the program.
const isLibraryImport = (text) => /common[-_]?library/i.test(text);

// Lua loads the library into a variable: `local common_library = require(...)`.
const isLibraryLoad = (statement) =>
  statement.value?.kind === 'Call' &&
  statement.value.callee === 'require' &&
  isLibraryImport(statement.value.arguments[0]?.value ?? '');

// Consecutive prints that came from library calls are one print statement:
// the writes up to and including the one that ends the line are joined.
function mergeLibraryPrints(statements) {
  const merged = [];
  let pending = [];
  const flush = (newline) => {
    if (pending.length > 0 || newline) {
      merged.push(
        node('Print', {
          value: partsToValue(pending.map((print) => print.value)),
          newline,
        })
      );
    }
    pending = [];
  };
  for (const statement of statements) {
    if (statement.kind !== 'Print' || !statement.fromLibrary) {
      flush(false);
      merged.push(statement);
    } else if (statement.newline) {
      pending.push(statement);
      flush(true);
    } else {
      pending.push(statement);
    }
  }
  flush(false);
  return merged;
}

// Understanding rule: a call to a library operation, however the source
// spells and qualifies it, is a print statement again.
export function recognizeCommonLibrary(program) {
  const ownFunctions = new Set(program.functions.map((item) => item.name));
  const recognized = rewrite(program, (current) => {
    const expression = current.expression;
    if (
      current.kind !== 'Evaluate' ||
      expression?.kind !== 'Call' ||
      ownFunctions.has(expression.callee)
    ) {
      return current;
    }
    const operation = nameWords(expression.callee.split(/\.|::/).at(-1)).join(
      '-'
    );
    const [argument] = expression.arguments;
    switch (operation) {
      case 'print-line':
        return libraryPrint(argument, true);
      case 'write-text':
      case 'write-integer':
        return libraryPrint(argument, false);
      case 'end-line':
        return libraryPrint(node('Text', { value: '' }), true);
      default:
        return current;
    }
  });
  const merged = rewrite(recognized, (current) =>
    current.kind === 'Block'
      ? { ...current, statements: mergeLibraryPrints(current.statements) }
      : current
  );
  return {
    ...merged,
    main: {
      ...merged.main,
      statements: merged.main.statements.filter(
        (statement) => !isLibraryLoad(statement)
      ),
    },
    imports: merged.imports.filter((text) => !isLibraryImport(text)),
  };
}

const libraryPrint = (value, newline) =>
  node('Print', { value, newline, fromLibrary: true });

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
