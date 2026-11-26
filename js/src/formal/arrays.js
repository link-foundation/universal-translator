// Arrays of integers in the meta language (see meta.js): the rules that read
// each language's array spellings into ArrayLiteral, NewArray, Index and
// Length, and the rules that move between NewArray and the fill loop that
// languages without a filled array constructor write instead.

import { languageSyntax } from './languages.js';
import { freshName, usedNames } from '../meta/for-each.js';
import { mapOrigins, inheritOrigin } from '../translation/source-origins.js';
import {
  block,
  essence,
  name,
  node,
  number,
  rewrite,
  walk,
} from '../meta/tree.js';

// `index + delta` with the constants folded, so that adding 1 for a
// language that counts from 1 and subtracting it again gives back the
// original index: a[i] <-> a[i + 1], a[i + 1] <-> a[i + 2], a[i - 1] <-> a[i].
export function offset(expression, delta) {
  if (delta === 0) {
    return expression;
  }
  if (expression.kind === 'Number') {
    return number(expression.value + delta);
  }
  const { operator, left, right } = expression;
  if (
    expression.kind === 'Binary' &&
    (operator === 'add' || operator === 'subtract') &&
    right.kind === 'Number' &&
    right.value > 0
  ) {
    const current = operator === 'add' ? right.value : -right.value;
    return offset(left, current + delta);
  }
  return node('Binary', {
    operator: delta > 0 ? 'add' : 'subtract',
    left: expression,
    right: number(Math.abs(delta)),
  });
}

// The index of the first element: 0, or 1 in Lua, Julia, R, Fortran and
// MATLAB.
export const arrayBase = (syntax) => syntax.arrayBase ?? 0;

export const isArrayValue = (value) =>
  value?.kind === 'ArrayLiteral' || value?.kind === 'NewArray';

const sameExpression = (left, right) =>
  JSON.stringify(essence(left)) === JSON.stringify(essence(right));

const mentions = (tree, identifier) => {
  let found = false;
  walk(tree, (current) => {
    if (current.kind === 'Name' && current.name === identifier) {
      found = true;
    }
  });
  return found;
};

// ---------------------------------------------------------------------------
// Reading: library spellings of the array concepts
// ---------------------------------------------------------------------------

const call = (expression, callee, count) =>
  expression.kind === 'Call' &&
  expression.callee === callee &&
  (count === undefined || expression.arguments.length === count);

const isNumber = (expression, value) =>
  expression?.kind === 'Number' && expression.value === value;

// How each language creates an array with a call: the meta node, or
// undefined when the expression is something else.
const constructors = {
  javascript(expression) {
    const [made, fill] = expression.arguments ?? [];
    return call(expression, '.fill', 2) && call(made, 'new Array', 1)
      ? node('NewArray', { length: made.arguments[0], fill })
      : undefined;
  },
  python(expression) {
    const { operator, left, right } = expression;
    return expression.kind === 'Binary' &&
      operator === 'multiply' &&
      left.kind === 'ArrayLiteral' &&
      left.elements.length === 1
      ? node('NewArray', { length: right, fill: left.elements[0] })
      : undefined;
  },
  ruby: (expression) =>
    call(expression, 'Array.new', 2)
      ? node('NewArray', {
          length: expression.arguments[0],
          fill: expression.arguments[1],
        })
      : undefined,
  php(expression) {
    // PHP 5 writes the literal [1, 2] as array(1, 2).
    if (call(expression, 'array')) {
      return node('ArrayLiteral', { elements: expression.arguments });
    }
    return call(expression, 'array_fill', 3) &&
      isNumber(expression.arguments[0], 0)
      ? node('NewArray', {
          length: expression.arguments[1],
          fill: expression.arguments[2],
        })
      : undefined;
  },
  go: (expression) =>
    call(expression, 'make', 2) && expression.arguments[0].kind === 'ArrayType'
      ? node('NewArray', { length: expression.arguments[1], fill: number(0) })
      : undefined,
  kotlin: (expression) =>
    call(expression, 'intArrayOf')
      ? node('ArrayLiteral', { elements: expression.arguments })
      : undefined,
  dart: (expression) =>
    call(expression, 'List.filled', 2)
      ? node('NewArray', {
          length: expression.arguments[0],
          fill: expression.arguments[1],
        })
      : undefined,
  scala: (expression) =>
    call(expression, 'Array')
      ? node('ArrayLiteral', { elements: expression.arguments })
      : undefined,
  julia: (expression) =>
    call(expression, 'fill', 2)
      ? node('NewArray', {
          length: expression.arguments[1],
          fill: expression.arguments[0],
        })
      : undefined,
  r(expression) {
    if (call(expression, 'c')) {
      return node('ArrayLiteral', { elements: expression.arguments });
    }
    return call(expression, 'rep', 2)
      ? node('NewArray', {
          length: expression.arguments[1],
          fill: expression.arguments[0],
        })
      : undefined;
  },
  nim: (expression) =>
    call(expression, 'newSeqWith', 2)
      ? node('NewArray', {
          length: expression.arguments[0],
          fill: expression.arguments[1],
        })
      : undefined,
  fortran: (expression) =>
    call(expression, 'spread', 3) && isNumber(expression.arguments[1], 1)
      ? node('NewArray', {
          length: expression.arguments[2],
          fill: expression.arguments[0],
        })
      : undefined,
  // Pascal: SetLength(a, n) gives a the length n, filled with zeros.
  pascal(statement) {
    const made = statement.expression;
    return statement.kind === 'Evaluate' &&
      made.kind === 'Call' &&
      made.callee.toLowerCase() === 'setlength' &&
      made.arguments.length === 2 &&
      made.arguments[0].kind === 'Name'
      ? node('Assignment', {
          name: made.arguments[0].name,
          operator: '=',
          value: node('NewArray', {
            length: made.arguments[1],
            fill: number(0),
          }),
        })
      : undefined;
  },
  matlab: (expression) =>
    call(expression, 'repmat', 3) && isNumber(expression.arguments[1], 1)
      ? node('NewArray', {
          length: expression.arguments[2],
          fill: expression.arguments[0],
        })
      : undefined,
};
constructors.typescript = constructors.javascript;
// GameMaker Language: array_create(n, fill).
constructors.gml = (expression) =>
  call(expression, 'array_create', 2)
    ? node('NewArray', {
        length: expression.arguments[0],
        fill: expression.arguments[1],
      })
    : undefined;
constructors.groovy = constructors.python;

// Calls that return the length of the array they are given.
const lengthCalls = new Set([
  'len',
  'length',
  'count',
  'numel',
  'scalar',
  'array_length',
]);
// Properties and methods that return the length of their receiver.
const lengthMembers = new Set(['length', 'Length', 'size', 'count', 'len']);

// The names a program declares with an array value or type, or indexes (a
// fragment may use an array it does not declare).
function arrayNames(program) {
  const names = new Set();
  walk(program, (current) => {
    if (
      (current.kind === 'Declaration' || current.kind === 'Assignment') &&
      (isArrayValue(current.value) || current.type === 'array')
    ) {
      names.add(current.name);
    }
    if (current.kind === 'Index' && current.array?.kind === 'Name') {
      names.add(current.array.name);
    }
    if (current.kind === 'IndexAssignment') {
      names.add(current.name);
    }
    // Fortran: size(a, kind=8) only measures arrays.
    const [first, second] = current.kind === 'Call' ? current.arguments : [];
    if (
      current.callee === 'size' &&
      first?.kind === 'Name' &&
      second?.kind === 'NamedArgument'
    ) {
      names.add(first.name);
    }
  });
  return names;
}

// The array a member spelling such as `a.length` or `a.len()` names.
function memberArray(spelling, arrays) {
  const dot = spelling.lastIndexOf('.');
  const owner = spelling.slice(0, dot);
  return dot > 0 &&
    arrays.has(owner) &&
    lengthMembers.has(spelling.slice(dot + 1))
    ? owner
    : undefined;
}

function lengthOf(expression, arrays) {
  const length = (owner) => node('Length', { array: name(owner) });
  if (expression.kind === 'Name') {
    const owner = memberArray(expression.name, arrays);
    return owner && length(owner);
  }
  if (expression.kind !== 'Call') {
    return undefined;
  }
  const [first] = expression.arguments;
  if (expression.arguments.length === 0) {
    const owner = memberArray(expression.callee, arrays);
    return owner && length(owner);
  }
  // Fortran asks for the size as an integer(8): size(a, kind=8).
  const known =
    lengthCalls.has(expression.callee.toLowerCase()) ||
    (expression.callee === 'size' &&
      expression.arguments[1]?.kind === 'NamedArgument');
  return known && first.kind === 'Name' && arrays.has(first.name)
    ? length(first.name)
    : undefined;
}

// C: sizeof a / sizeof a[0].
function sizeOfLength(expression) {
  const { operator, left, right } = expression;
  if (
    expression.kind === 'Binary' &&
    operator === 'divide' &&
    left.kind === 'SizeOf' &&
    right.kind === 'SizeOf' &&
    left.operand.kind === 'Name' &&
    right.operand.kind === 'Index' &&
    right.operand.array.name === left.operand.name
  ) {
    return node('Length', { array: left.operand });
  }
  return undefined;
}

// Read every array spelling of the source language into the meta nodes.
// Constructors come first, so that the names they declare are known when
// `a.length` or, where parentheses index (Scala, MATLAB, Fortran, Visual
// Basic, Ada), `a(i)` is read.
export function recognizeArrays(program, { from } = {}) {
  if (!from) {
    return program;
  }
  const syntax = languageSyntax(from);
  // A version of a language (python@2) builds arrays like the language,
  // unless it has constructors of its own (GameMaker Language).
  const construct =
    constructors[syntax.id] ?? constructors[syntax.family ?? syntax.id];
  const constructed = construct
    ? rewrite(program, (current) => construct(current) ?? current)
    : program;
  const arrays = arrayNames(constructed);
  const functions = new Set(program.functions.map((item) => item.name));
  const base = arrayBase(syntax);
  return rewrite(constructed, (current) => {
    // Scala indexes with an Int: a(i.toInt).
    if (current.kind === 'Name' && current.name.endsWith('.toInt')) {
      return name(current.name.slice(0, -'.toInt'.length));
    }
    if (current.kind === 'Method' && current.name === 'toInt') {
      return current.receiver;
    }
    const length = lengthOf(current, arrays) ?? sizeOfLength(current);
    if (length) {
      return length;
    }
    if (
      current.kind === 'Call' &&
      arrays.has(current.callee) &&
      !functions.has(current.callee) &&
      current.arguments.length === 1
    ) {
      return node('Index', {
        array: name(current.callee),
        index: offset(current.arguments[0], -base),
      });
    }
    return current;
  });
}

// ---------------------------------------------------------------------------
// Fill loops
// ---------------------------------------------------------------------------

// The loop `for i in 0..n: a[i] = v` right after `a = NewArray(n, 0)` (or
// after `a = []` where an array grows as it is filled) is the array
// `NewArray(n, v)` written at a lower level.
function isFillLoop(loop) {
  return (
    loop?.kind === 'CountingLoop' &&
    isNumber(loop.start, 0) &&
    loop.body.statements.length === 1
  );
}

// `a[i] = v` with v free of both the array and the loop variable.
function storesEachSlot(store, array, variable) {
  return (
    store.kind === 'IndexAssignment' &&
    store.name === array &&
    store.index.kind === 'Name' &&
    store.index.name === variable &&
    !mentions(store.value, variable) &&
    !mentions(store.value, array)
  );
}

function filledArray(declaration, loop) {
  const created = declaration?.value;
  const empty =
    created?.kind === 'ArrayLiteral' && created.elements.length === 0;
  const zero = created?.kind === 'NewArray' && isNumber(created.fill, 0);
  if (declaration?.kind !== 'Declaration' || !(empty || zero)) {
    return undefined;
  }
  if (!isFillLoop(loop)) {
    return undefined;
  }
  const [store] = loop.body.statements;
  const array = declaration.name;
  const ends = (end) =>
    (end.kind === 'Length' && end.array.name === array) ||
    (zero && sameExpression(end, created.length)) ||
    (empty && !mentions(end, array));
  if (!storesEachSlot(store, array, loop.variable) || !ends(loop.end)) {
    return undefined;
  }
  return {
    ...declaration,
    value: node('NewArray', {
      length: zero ? created.length : loop.end,
      fill: store.value,
    }),
  };
}

export function raiseArrayFills(program) {
  return rewrite(program, (current) => {
    if (current.kind !== 'Block') {
      return current;
    }
    const statements = [];
    for (const statement of current.statements) {
      const filled = filledArray(statements.at(-1), statement);
      if (filled) {
        statements[statements.length - 1] = filled;
      } else {
        statements.push(statement);
      }
    }
    return { ...current, statements };
  });
}

const callFree = (expression) => {
  let free = true;
  walk(expression, (current) => {
    if (current.kind === 'Call') {
      free = false;
    }
  });
  return free;
};

// Languages without a filled array constructor (C, Java, Go, Pascal, Lua,
// Bash and others, as `arrayFill` in languages.js says) create the array
// and fill it with a counting loop. "always": the new array holds no
// values yet (C's variable-length arrays); "nonzero": it starts with
// zeros; "empty": the array is empty and grows as the loop fills it.
export function expandArrayFills(program, { to, target = to }) {
  const style = languageSyntax(target).arrayFill;
  if (!style) {
    return program;
  }
  const expand = (body, parameters) => {
    let variable;
    return rewrite(body, (current) => {
      if (current.kind !== 'Block') {
        return current;
      }
      const statements = current.statements.flatMap((statement) => {
        const created = statement.kind === 'Declaration' && statement.value;
        if (
          created?.kind !== 'NewArray' ||
          (style === 'nonzero' && isNumber(created.fill, 0))
        ) {
          return [statement];
        }
        variable ??= freshName(usedNames(body, parameters));
        const empty = style === 'empty';
        const declaration = {
          ...statement,
          value: empty
            ? node('ArrayLiteral', { elements: [], type: 'array' })
            : { ...created, fill: number(0) },
        };
        const end =
          empty || callFree(created.length)
            ? created.length
            : node('Length', {
                array: name(statement.name),
                type: 'integer',
              });
        const loop = node('CountingLoop', {
          variable,
          start: number(0),
          end,
          body: block([
            node('IndexAssignment', {
              name: statement.name,
              index: name(variable),
              value: created.fill,
            }),
          ]),
        });
        return [
          inheritOrigin(declaration, statement),
          inheritOrigin(loop, statement),
        ];
      });
      return { ...current, statements };
    });
  };
  return {
    ...program,
    functions: mapOrigins(program.functions, (item) => ({
      ...item,
      body: expand(item.body, item.parameters),
    })),
    main: expand(program.main, []),
  };
}
