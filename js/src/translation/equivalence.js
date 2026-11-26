// Equivalence of two programs: both are read into the meta language, put in
// the general form of the standard library and compared node by node. What
// a language writes but a program does not mean (comments, imports, blank
// lines) is left out, so a program and its translation are equivalent when
// they compute the same thing in the same way.

import { generalize } from '../meta/library.js';

// The parts of a meta tree that are layout or notes, not meaning.
export const layoutKeys = Object.freeze([
  'comments',
  'mainComments',
  'imports',
  'blankAfter',
  'blankBefore',
]);

// Statements that are notes: a comment on a line of its own.
const noteKinds = new Set(['Comment']);

const meaningful = (list) => list.filter((item) => !noteKinds.has(item?.kind));

// Types a reader writes when it cannot tell: they agree with any type.
const unknownTypes = new Set(['unknown', 'any', 'dynamic']);

const isObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const typeKeys = new Set(['type', 'returnType', 'elementType']);

function comparableTypes(left, right) {
  return (
    left === undefined ||
    right === undefined ||
    unknownTypes.has(left) ||
    unknownTypes.has(right)
  );
}

// The keys of a node that carry meaning, in a stable order.
function meaningKeys(node, ignored) {
  return Object.keys(node).filter(
    (key) => !ignored.has(key) && node[key] !== undefined
  );
}

function compareLists(left, right, path, context) {
  if (left.length !== right.length) {
    context.differences.push({
      path: `${path}.length`,
      left: left.length,
      right: right.length,
    });
  }
  const shared = Math.min(left.length, right.length);
  for (let index = 0; index < shared; index += 1) {
    compareNodes(left[index], right[index], `${path}[${index}]`, context);
  }
}

function compareObjects(left, right, path, context) {
  const keys = new Set([
    ...meaningKeys(left, context.ignored),
    ...meaningKeys(right, context.ignored),
  ]);
  for (const key of keys) {
    const at = path ? `${path}.${key}` : key;
    if (typeKeys.has(key)) {
      if (
        context.types === 'strict' ||
        !comparableTypes(left[key], right[key])
      ) {
        compareNodes(left[key], right[key], at, context);
      }
    } else {
      compareNodes(left[key], right[key], at, context);
    }
  }
}

function compareNodes(left, right, path, context) {
  if (Array.isArray(left) && Array.isArray(right)) {
    compareLists(meaningful(left), meaningful(right), path, context);
  } else if (isObject(left) && isObject(right)) {
    compareObjects(left, right, path, context);
  } else if (!Object.is(left, right)) {
    context.differences.push({ path, left, right });
  }
}

// The differences between two meta programs: [{ path, left, right }], empty
// when they are equivalent. `types: 'strict'` also compares a type one side
// does not know; `ignore` adds keys to leave out.
export function compareMeta(
  left,
  right,
  { types = 'known', ignore = [] } = {}
) {
  const context = {
    differences: [],
    ignored: new Set([...layoutKeys, ...ignore]),
    types,
  };
  compareNodes(generalize(left), generalize(right), '', context);
  return context.differences;
}

// Whether `target` in `to` means what `source` in `from` means. Without a
// target the source is translated first, so this checks a translation.
// { equivalent, differences, target }
export function checkEquivalence(
  translator,
  { source, from, to, target, ...options }
) {
  const written = target ?? translator.translate(source, from, to);
  const differences = compareMeta(
    translator.toMeta(source, from),
    translator.toMeta(written, to),
    options
  );
  return { equivalent: differences.length === 0, differences, target: written };
}
