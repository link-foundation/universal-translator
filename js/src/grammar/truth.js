// Languages without a boolean type (Perl, and machine code) return truth
// values as the integers 0 and 1. A function reads as returning a boolean
// when every value it returns is 0, 1 or a truth value and every call to it
// is used as a condition. Its literal returns then become false and true.

import { node, rewrite, walk } from './meta.js';

const comparisons = new Set([
  'equal',
  'notEqual',
  'less',
  'lessOrEqual',
  'greater',
  'greaterOrEqual',
]);

const isZero = (expression) =>
  expression?.kind === 'Number' && expression.value === 0;

const isBit = (expression) =>
  expression?.kind === 'Number' && [0, 1].includes(expression.value);

function isTruthValue(expression, truthFunctions) {
  switch (expression?.kind) {
    case 'Boolean':
      return true;
    case 'Unary':
      return expression.operator === 'not';
    case 'Call':
      return truthFunctions.has(expression.callee);
    case 'Binary':
      return (
        comparisons.has(expression.operator) ||
        ['and', 'or'].includes(expression.operator)
      );
    default:
      return false;
  }
}

// `call != 0` and `call == 0` test a truth value written as an integer.
const isZeroTest = (expression) =>
  expression?.kind === 'Binary' &&
  ['equal', 'notEqual'].includes(expression.operator) &&
  expression.left?.kind === 'Call' &&
  isZero(expression.right);

// Functions called somewhere other than as a condition. The tree is
// copied while walking, so calls are counted per function name.
function callUses(program) {
  const asCondition = new Map();
  const count = (map, callee) => map.set(callee, (map.get(callee) ?? 0) + 1);
  const conditions = (expression) => {
    if (expression?.kind === 'Call') {
      count(asCondition, expression.callee);
    } else if (isZeroTest(expression)) {
      count(asCondition, expression.left.callee);
    }
  };
  const all = new Map();
  walk(program, (current) => {
    if (current.kind === 'Call') {
      count(all, current.callee);
    }
    if (['If', 'While'].includes(current.kind)) {
      conditions(current.condition);
    }
    if (current.kind === 'Unary' && current.operator === 'not') {
      conditions(current.operand);
    }
    if (current.kind === 'Binary' && ['and', 'or'].includes(current.operator)) {
      conditions(current.left);
      conditions(current.right);
    }
  });
  return new Set(
    [...all]
      .filter(([callee, total]) => asCondition.get(callee) !== total)
      .map(([callee]) => callee)
  );
}

function returnedValues(body) {
  const values = [];
  walk(body, (current) => {
    if (current.kind === 'Return') {
      values.push(current.value);
    }
  });
  return values;
}

export function raiseTruthFunctions(program) {
  const functions = program.functions ?? [];
  const usedOtherwise = callUses(program);
  const candidates = functions.filter(
    (item) =>
      !usedOtherwise.has(item.name) &&
      ['integer', 'boolean', undefined].includes(item.returnType)
  );
  // A function may return the result of another truth function, so the set
  // shrinks until every member returns only bits and truth values.
  let truthFunctions = new Set(candidates.map((item) => item.name));
  for (;;) {
    const kept = new Set(
      candidates
        .filter((item) => truthFunctions.has(item.name))
        .filter((item) => {
          const values = returnedValues(item.body);
          return (
            values.length > 0 &&
            values.every(
              (value) => isBit(value) || isTruthValue(value, truthFunctions)
            )
          );
        })
        .map((item) => item.name)
    );
    if (kept.size === truthFunctions.size) {
      break;
    }
    truthFunctions = kept;
  }
  if (truthFunctions.size === 0) {
    return program;
  }
  const raiseReturns = (body) =>
    rewrite(body, (current) =>
      current.kind === 'Return' && isBit(current.value)
        ? {
            ...current,
            value: node('Boolean', { value: current.value.value === 1 }),
          }
        : current
    );
  const raiseTests = (tree) =>
    rewrite(tree, (current) => {
      if (!isZeroTest(current) || !truthFunctions.has(current.left.callee)) {
        return current;
      }
      return current.operator === 'notEqual'
        ? current.left
        : node('Unary', { operator: 'not', operand: current.left });
    });
  return raiseTests({
    ...program,
    functions: functions.map((item) =>
      truthFunctions.has(item.name)
        ? {
            ...item,
            body: raiseReturns(item.body),
            ...(item.returnType && { returnType: 'boolean' }),
          }
        : item
    ),
  });
}
