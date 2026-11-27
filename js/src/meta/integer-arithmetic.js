// Rounding modes are semantic operations; helpers lower them to native ones.
import data from '../../../data/integer-arithmetic.json' with { type: 'json' };
import { node, number, rewrite, walk, sameMeaning } from './tree.js';

const helperBodies = Object.entries(data.helpers).map(
  ([operator, template]) => [
    operator,
    [
      template.body,
      // Legacy helpers spell the local "result", which Nim reserves.
      rewrite(template.body, (item) =>
        item.name === 'quotient' ? { ...item, name: 'result' } : item
      ),
    ],
  ]
);

export const floorDivision = (id) => data.floorDivision.includes(id);
export const floorModulo = (id) => data.floorModulo.includes(id);

function mayProduceNegativeZero({ operator, left, right }) {
  if (left.kind !== 'Number' || right.kind !== 'Number') {
    return true;
  }
  const dividend = left.value + 0;
  const divisor = right.value + 0;
  const values = {
    divide: () => Math.trunc(dividend / divisor),
    remainder: () => dividend % divisor,
    multiply: () => dividend * divisor,
  };
  return Object.is(values[operator](), -0);
}

function normalizeIntegerZero(item) {
  // In JavaScript, -0 + 0 is +0 and evaluates the integer operation once.
  return item.type === 'integer' && mayProduceNegativeZero(item)
    ? node('Binary', {
        operator: 'add',
        left: item,
        right: { ...number(0), type: 'integer' },
        type: 'integer',
      })
    : item;
}

export function normalizeMachineIntegerZero(program) {
  return rewrite(program, (item) =>
    item.kind === 'Binary' &&
    ['divide', 'remainder', 'multiply'].includes(item.operator)
      ? normalizeIntegerZero(item)
      : item
  );
}

const native = (operator, id) => {
  switch (operator) {
    case 'divide':
      return !floorDivision(id);
    case 'floorDivide':
      return floorDivision(id);
    case 'remainder':
      return !floorModulo(id);
    case 'modulo':
      return floorModulo(id);
    default:
      return true;
  }
};

export function lowerIntegerArithmetic(program, { from, to: id, target }) {
  const normalizeZero =
    ['c', 'cpp', 'objc'].includes(from) &&
    ['javascript', 'typescript'].includes(id);
  const used = new Set();
  walk(program, (current) => {
    if (current.name) {
      used.add(current.name);
    }
    if (current.variable) {
      used.add(current.variable);
    }
    if (current.kind === 'Call') {
      used.add(current.callee);
    }
    if (current.kind === 'Function') {
      current.parameters.forEach((p) => used.add(p.name));
    }
    if (current.kind === 'Lambda') {
      current.parameters.forEach((p) => used.add(p));
    }
  });
  const names = new Map();
  const functions = [];
  const helper = (operator) => {
    if (names.has(operator)) {
      return names.get(operator);
    }
    const template = data.helpers[operator];
    let callee = template.name;
    for (let suffix = 2; used.has(callee); suffix += 1) {
      callee = `${template.name}-${suffix}`;
    }
    used.add(callee);
    names.set(operator, callee);
    const definition = lower({ ...template, name: callee });
    functions.push(definition);
    return callee;
  };
  const lower = (tree) =>
    rewrite(tree, (current) => {
      if (
        normalizeZero &&
        current.kind === 'Binary' &&
        ['divide', 'remainder'].includes(current.operator)
      ) {
        return normalizeIntegerZero(current);
      }
      if (current.kind !== 'Binary' || native(current.operator, id)) {
        return current;
      }
      if (current.type === 'real') {
        throw new Error(
          `Real ${current.operator} has no verified lowering for ${target}`
        );
      }
      return node('Call', {
        callee: helper(current.operator),
        arguments: [current.left, current.right],
        type: 'integer',
      });
    });
  const lowered = lower(program);
  return functions.length
    ? { ...lowered, functions: [...functions, ...lowered.functions] }
    : lowered;
}

// Recognize the full algorithm, not its name. Reject rebinding and escaping.
export function raiseIntegerArithmetic(program) {
  let current = program;
  for (;;) {
    const candidates = new Map();
    const definitions = new Map();
    for (const item of current.functions ?? []) {
      definitions.set(item.name, (definitions.get(item.name) ?? 0) + 1);
      if (
        !item.name.startsWith('ut-integer-') ||
        item.documentation ||
        item.parameters.length !== 2 ||
        item.parameters.some((p, i) => p.name !== ['first', 'second'][i]) ||
        item.returnType !== 'integer'
      ) {
        continue;
      }
      for (const [operator, bodies] of helperBodies) {
        if (bodies.some((body) => sameMeaning(item.body, body))) {
          candidates.set(item.name, operator);
        }
      }
    }
    for (const [name, count] of definitions) {
      if (count !== 1) {
        candidates.delete(name);
      }
    }
    walk(current, (item) => {
      if (
        item.kind === 'Name' ||
        ['Declaration', 'Assignment', 'Catch'].includes(item.kind)
      ) {
        candidates.delete(item.name);
      }
      if (item.variable) {
        candidates.delete(item.variable);
      }
      if (item.kind === 'Function') {
        item.parameters.forEach((p) => candidates.delete(p.name));
      }
      if (item.kind === 'Lambda') {
        item.parameters.forEach((p) => candidates.delete(p));
      }
      if (item.kind === 'Call' && item.arguments.length !== 2) {
        candidates.delete(item.callee);
      }
    });
    if (!candidates.size) {
      return current;
    }
    current = rewrite(
      {
        ...current,
        functions: current.functions.filter((f) => !candidates.has(f.name)),
      },
      (item) =>
        item.kind === 'Call' && candidates.has(item.callee)
          ? node('Binary', {
              operator: candidates.get(item.callee),
              left: item.arguments[0],
              right: item.arguments[1],
              type: 'integer',
            })
          : item
    );
  }
}
