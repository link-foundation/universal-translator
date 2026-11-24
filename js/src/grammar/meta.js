// Meta language tree: the language-independent representation that every
// parser produces and every emitter consumes. Node kinds use full words.
//
//   Program        { comments, imports, functions, main }
//   Function       { name, parameters: [{ name, type }], returnType, body, comments }
//   Block          { statements }
//   Declaration    { name, type, value, mutable }
//   Assignment     { name, operator, value }
//   If             { condition, then, otherwise }
//   While          { condition, body }
//   CountingLoop   { variable, start, end (exclusive), body }
//   Return         { value }
//   Print          { value, newline }
//   Evaluate       { expression }
//   Comment        { text }
//   Number         { value }            Text { value }    Boolean { value }
//   Name           { name }             Interpolation { parts }
//   Binary         { operator, left, right }
//   Unary          { operator, operand }
//   Call           { callee, arguments }
//
// Binary operators: add, subtract, multiply, divide, remainder, equal,
// notEqual, less, lessOrEqual, greater, greaterOrEqual, and, or.
// Unary operators: negate, not.

export const node = (kind, fields = {}) => ({ kind, ...fields });

export const block = (statements = []) => node('Block', { statements });

export const number = (value) => node('Number', { value });

export const text = (value) => node('Text', { value });

export const name = (identifier) => node('Name', { name: identifier });

export function add(left, right) {
  if (left.kind === 'Number' && right.kind === 'Number') {
    return number(left.value + right.value);
  }
  if (right.kind === 'Number' && right.value === 0) {
    return left;
  }
  if (right.kind === 'Number' && right.value < 0) {
    return subtract(left, number(-right.value));
  }
  if (
    left.kind === 'Binary' &&
    left.operator === 'subtract' &&
    right.kind === 'Number' &&
    left.right.kind === 'Number' &&
    left.right.value === right.value
  ) {
    return left.left;
  }
  return node('Binary', { operator: 'add', left, right });
}

export function subtract(left, right) {
  if (left.kind === 'Number' && right.kind === 'Number') {
    return number(left.value - right.value);
  }
  if (
    left.kind === 'Binary' &&
    left.operator === 'add' &&
    right.kind === 'Number' &&
    left.right.kind === 'Number' &&
    left.right.value === right.value
  ) {
    return left.left;
  }
  return node('Binary', { operator: 'subtract', left, right });
}

// Visit every node of a tree, children first, replacing each node with the
// value returned by `visit`. Rules use this to rewrite one concept at a time.
export function rewrite(tree, visit) {
  if (Array.isArray(tree)) {
    return tree.flatMap((item) => {
      const result = rewrite(item, visit);
      return result === undefined ? [] : [result];
    });
  }
  if (!tree || typeof tree !== 'object' || !tree.kind) {
    return tree;
  }
  const copy = {};
  for (const [key, value] of Object.entries(tree)) {
    copy[key] =
      value && typeof value === 'object' ? rewrite(value, visit) : value;
  }
  return visit(copy);
}

// Visit every node without changing the tree.
export function walk(tree, visit) {
  rewrite(tree, (current) => {
    visit(current);
    return current;
  });
}

// Structural comparison that ignores source-only details such as types that
// an untyped language cannot express and comment wording.
const ignoredKeys = new Set([
  'type',
  'returnType',
  'comments',
  'mainComments',
  'imports',
  'mutable',
]);

// The meaning of a program, without details that do not change behaviour:
// comments, imports, inferred types and mutability.
export function essence(tree) {
  const withoutComments = rewrite(tree, (current) =>
    current.kind === 'Comment' ? undefined : current
  );
  return JSON.parse(
    JSON.stringify(withoutComments, (key, value) =>
      ignoredKeys.has(key) ? undefined : value
    )
  );
}

// The first path where two programs differ in meaning, or undefined.
export function meaningDifference(left, right, path = '') {
  const [a, b] = path ? [left, right] : [essence(left), essence(right)];
  if (a === b) {
    return undefined;
  }
  if (
    typeof a !== 'object' ||
    typeof b !== 'object' ||
    a === null ||
    b === null
  ) {
    return `${path || '/'}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`;
  }
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const difference = meaningDifference(a[key], b[key], `${path}/${key}`);
    if (difference) {
      return difference;
    }
  }
  return undefined;
}

export function sameMeaning(left, right) {
  return meaningDifference(left, right) === undefined;
}
