// Whether a translation does what its source does, as far as the meta
// language can tell: both texts are read into meta programs, and the two
// must be the same when the parts without an effect on a run are left out.
// Those parts are comments, imports, blank lines, declared types and
// whether a variable may change. Two programs with the same meta program
// run the same statements on the same values in the same order, so this is
// a proof of the same effect for the narrow set of programs the meta
// language reads; anything the meta language does not model (overflow,
// float formatting, library behaviour) stays outside it.

import { formatMeta } from '../meta/notation.js';

// Fields that do not change what a program does.
const WITHOUT_EFFECT = new Set([
  'blankAfter',
  'comments',
  'imports',
  'mainComments',
  'mutable',
  'returnType',
  'type',
]);

// Statements that do not change what a program does.
const LAYOUT = new Set(['Blank', 'Comment']);

const isLayout = (value) =>
  Boolean(value) && typeof value === 'object' && LAYOUT.has(value.kind);

// The meta program without the parts that have no effect.
export function effectOf(value) {
  if (Array.isArray(value)) {
    return value.filter((item) => !isLayout(item)).map(effectOf);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([field]) => !WITHOUT_EFFECT.has(field))
      .map(([field, child]) => [field, effectOf(child)])
  );
}

const MAX_DIFFERENCES = 5;

// The lines where two formatted meta programs differ, 1-based and without
// their indentation, at most MAX_DIFFERENCES of them.
function differencesOf(sourceLines, targetLines) {
  const differences = [];
  const length = Math.max(sourceLines.length, targetLines.length);
  for (let index = 0; index < length; index++) {
    if (differences.length === MAX_DIFFERENCES) {
      break;
    }
    if (sourceLines[index] !== targetLines[index]) {
      differences.push({
        line: index + 1,
        source: (sourceLines[index] ?? '').trim(),
        target: (targetLines[index] ?? '').trim(),
      });
    }
  }
  return differences;
}

const linesOf = (program) =>
  formatMeta(effectOf(program)).trimEnd().split('\n');

// Compares a source with a translation of it, written by the translator
// when none is given (a hand-written one is checked the same way).
// { equivalent, translation, metaLines, differences: [{ line, source, target }] }
export function checkEquivalence(
  translator,
  { source, from, to, translation, options = {} }
) {
  const target = translation ?? translator.translate(source, from, to, options);
  const sourceLines = linesOf(translator.toMeta(source, from));
  const targetLines = linesOf(translator.toMeta(target, to));
  const differences = differencesOf(sourceLines, targetLines);
  return {
    equivalent: differences.length === 0,
    translation: target,
    metaLines: sourceLines.length,
    differences,
  };
}
