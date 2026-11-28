// C-family operands use sequenced comma expressions, without compiler extensions.
import { node, name, number, rewrite, walk } from './tree.js';
import { inheritOrigin } from '../translation/source-origins.js';

const targets = new Set(['c', 'cpp', 'objc']);
const prefix = 'ut-evaluation';
const temporaryName = /^ut-evaluation\d+$/;
const scalar = (value) =>
  ['integer', 'real', 'boolean', 'text'].includes(value.type);
const literal = (value) => ['Number', 'Boolean', 'Text'].includes(value.kind);
const effectful = (tree) => {
  let found = false;
  walk(tree, (item) => {
    if (
      ['Call', 'Update', 'SetInsert', 'AssignmentExpression'].includes(
        item.kind
      )
    ) {
      found = true;
    }
  });
  return found;
};
const operands = (item) => {
  if (item.kind === 'Call') {
    return item.arguments;
  }
  if (item.kind === 'Binary' && !['and', 'or'].includes(item.operator)) {
    return [item.left, item.right];
  }
  return [];
};
const withOperands = (item, values) =>
  item.kind === 'Call'
    ? { ...item, arguments: values }
    : { ...item, left: values[0], right: values[1] };

export function lowerEvaluationOrder(program, { from, to }) {
  if (from !== 'python' || !targets.has(to)) {
    return program;
  }
  const used = new Set();
  walk(program, (item) => {
    for (const key of ['name', 'callee', 'variable']) {
      used.add(item[key]);
    }
    if (item.kind === 'Function') {
      item.parameters.forEach((p) => used.add(p.name));
    }
  });
  let index = 0;
  const fresh = () => {
    let identifier;
    do {
      identifier = `${prefix}${++index}`;
    } while (used.has(identifier) || used.has(`${prefix}-${index}`));
    used.add(identifier);
    return identifier;
  };
  const lowerBody = (body) => {
    const declarations = [];
    const lowered = rewrite(body, (item) => {
      const values = operands(item);
      if (
        values.filter((value) => !literal(value)).length < 2 ||
        !values.every(scalar) ||
        !values.some(effectful)
      ) {
        return item;
      }
      const steps = [],
        references = [];
      for (const value of values) {
        const { type } = value;
        const identifier = fresh();
        const initial =
          type === 'text'
            ? node('Text', { value: '', type })
            : type === 'boolean'
              ? node('Boolean', { value: false, type })
              : { ...number(0), type };
        declarations.push(
          inheritOrigin(
            node('Declaration', {
              name: identifier,
              type,
              value: initial,
              mutable: true,
            }),
            value
          )
        );
        steps.push(
          inheritOrigin(
            node('AssignmentExpression', {
              name: identifier,
              value,
              type,
            }),
            value
          )
        );
        references.push({ ...name(identifier), type });
      }
      return node('ExpressionSequence', {
        steps,
        value: withOperands(item, references),
        type: item.type,
      });
    });
    return inheritOrigin(
      { ...lowered, statements: [...declarations, ...lowered.statements] },
      body
    );
  };
  return inheritOrigin(
    {
      ...program,
      main: lowerBody(program.main),
      functions: program.functions.map((f) =>
        inheritOrigin({ ...f, body: lowerBody(f.body) }, f)
      ),
    },
    program
  );
}

// Remove only private temporaries with one declaration, write and read, whose
// complete comma sequence preserves operand positions. Escapes remain explicit.
export function raiseEvaluationOrder(program) {
  const raiseBody = (body) => {
    const declared = new Map(),
      reads = new Map(),
      writes = new Map();
    const add = (map, identifier) =>
      map.set(identifier, (map.get(identifier) ?? 0) + 1);
    for (const item of body.statements) {
      if (
        item.kind === 'Declaration' &&
        temporaryName.test(item.name) &&
        ['Number', 'Boolean', 'Text'].includes(item.value?.kind) &&
        [0, false, ''].includes(item.value.value)
      ) {
        declared.set(item.name, item.type);
      }
    }
    walk(body, (item) => {
      if (item.kind === 'Name') {
        add(reads, item.name);
      }
      if (
        [
          'Assignment',
          'AssignmentExpression',
          'Declaration',
          'IndexAssignment',
          'Catch',
        ].includes(item.kind)
      ) {
        add(writes, item.name);
      }
      if (item.kind === 'Call') {
        add(reads, item.callee);
      }
      if (item.variable) {
        add(reads, item.variable);
      }
    });
    const removed = new Set();
    const raised = rewrite(body, (item) => {
      if (item.kind !== 'ExpressionSequence') {
        return item;
      }
      const values = operands(item.value);
      if (
        values.length !== item.steps.length ||
        values.length < 2 ||
        !item.steps.every(
          (step, i) =>
            step.kind === 'AssignmentExpression' &&
            values[i].kind === 'Name' &&
            values[i].name === step.name &&
            scalar(step.value) &&
            declared.get(step.name) === step.value.type &&
            writes.get(step.name) === 2 &&
            reads.get(step.name) === 1
        )
      ) {
        return item;
      }
      item.steps.forEach((s) => removed.add(s.name));
      return withOperands(
        item.value,
        item.steps.map((s) => s.value)
      );
    });
    return inheritOrigin(
      {
        ...raised,
        statements: raised.statements.filter(
          (s) => s.kind !== 'Declaration' || !removed.has(s.name)
        ),
      },
      body
    );
  };
  return inheritOrigin(
    {
      ...program,
      main: raiseBody(program.main),
      functions: program.functions.map((f) =>
        inheritOrigin({ ...f, body: raiseBody(f.body) }, f)
      ),
    },
    program
  );
}
