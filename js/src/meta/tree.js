// Meta language tree: the language-independent representation that every
// parser produces and every emitter consumes. Node kinds use full words.
//
//   Program        { comments, imports, functions, main }
//   Function       { name, parameters: [{ name, type, annotations? }], returnType, body, comments, annotations? }
//   Annotation     { expression }       method or parameter metadata
//   Block          { statements }
//   Declaration    { name, type, value, mutable }
//   Assignment     { name, operator, value }
//   If             { condition, then, otherwise }
//   While          { condition, body }
//   CountingLoop   { variable, start, end (exclusive), body }
//   ForEach        { variable, array, body }   the body runs once for each
//                  element of the array, with the variable holding it
//   Return         { value }
//   Print          { value, newline }
//   Evaluate       { expression }
//   Throw          { value?, mode }    an exception object or arbitrary value
//   Try            { body, handlers, success?, finalizer? }
//   Catch          { name?, type?, body }
//   Comment        { text, trailing?, block? }   trailing: the spaces between
//                  the code and a comment on the same line; block: written
//                  as a block comment
//   Blank          { lines }           empty lines between two statements
//   Number         { value }            Text { value }    Boolean { value }
//   Name           { name }             Interpolation { parts }
//   Binary         { operator, left, right }
//   Unary          { operator, operand }
//   Null           {}                    SQL absence of a value
//   SqlBinary      { operator, left, right }   NULL-propagating SQL operation
//   SqlUnary       { operator, operand }      NULL-propagating SQL operation
//   SqlTruth       { operand }           SQL WHERE retains only true rows
//   Call           { callee, arguments }
//   Question       { aspect: type | documentation | source | details, subject }
//   Query          { source, variable, condition, projection, eager }
//   Lambda         { parameters, body }
//   PropertyAssignment { object, property, value }
//   ArrayLiteral   { elements }         NewArray { length, fill }
//   Index          { array, index }     Length { array }
//   IndexAssignment { name, index, value }
//
// Arrays hold integers and have a fixed length. A program creates one only
// as the value of a declaration (ArrayLiteral or NewArray, every element
// equal to `fill`); `array` and the array of Length are always a Name.
// Indexes count from 0: languages that count from 1 add 1 when they write
// an index and subtract it when they read one. The meta type is "array".
// The array of a ForEach is a Name too; the loop variable has the type of
// the elements, and languages without a for-each loop write a CountingLoop
// over a fresh index whose body starts with `variable = array[index]`.
//
// Integer divide truncates toward zero; floorDivide rounds downward.
// Remainder follows the dividend sign; modulo follows the divisor sign.
// Binary operators: add, subtract, multiply, divide, floorDivide, realDivide,
// remainder, modulo, power, equal,
// notEqual, less, lessOrEqual, greater, greaterOrEqual, and, or.
// Unary operators: negate, not.

import { inheritOrigin } from '../translation/source-origins.js';

export const node = (kind, fields = {}) => ({ kind, ...fields });

export const block = (statements = []) => node('Block', { statements });

// Concrete syntax: empty lines only stand between two statements of a block,
// and two runs of them in a row merge.
export function layout(statements = []) {
  const kept = [];
  for (const statement of statements) {
    if (
      statement.kind === 'Blank' &&
      (!kept.length || kept.at(-1).kind === 'Blank')
    ) {
      continue;
    }
    kept.push(statement);
  }
  while (kept.at(-1)?.kind === 'Blank') {
    kept.pop();
  }
  return kept;
}

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
  inheritOrigin(copy, tree);
  return inheritOrigin(visit(copy), tree);
}

// Visit every node without changing the tree.
export function walk(tree, visit) {
  rewrite(tree, (current) => {
    visit(current);
    return current;
  });
}

// The functions that an earlier function calls before their definition.
// Languages that compile from top to bottom (C, Pascal, Ada) announce them
// with a prototype or forward declaration.
export function laterCalls(functions) {
  const defined = new Set();
  const announced = new Set();
  for (const item of functions) {
    defined.add(item.name);
    walk(item.body, (current) => {
      if (current.kind === 'Call' && !defined.has(current.callee)) {
        announced.add(current.callee);
      }
    });
  }
  return functions.filter((item) => announced.has(item.name));
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
  'elementsAssigned',
  'blankAfter',
  'imprecision',
]);

// The meaning of a program, without details that do not change behaviour:
// comments and empty lines, imports, inferred types and mutability.
export function essence(tree) {
  const withoutComments = rewrite(tree, (current) =>
    current.kind === 'Comment' || current.kind === 'Blank' ? undefined : current
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
