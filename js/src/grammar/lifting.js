// Lift stack machine code (see lowering.js) back into a meta program. This
// is the inverse of lowering: it rebuilds expressions with a symbolic stack
// and recognizes the jump patterns that lowering writes for conditions,
// "if", "while", counting loops and boolean values.
//
// Lowering patterns, with "→ X" meaning "compare-jump to X":
//
//   while    label T; condition → F; body; jump T; label F
//   if       condition → O; then; jump D; label O; otherwise; label D
//   boolean  condition → F; push 1; jump D; label F; push 0; label D
//
// A condition is a run of comparisons. Each comparison jumps to the false
// label F or to a "skip" label placed right after the run (for "or" inside
// "and", for example). The condition is rebuilt from the last comparison
// back to the first.

import { walk } from './meta.js';
import { neutralName } from './names.js';

const opposite = {
  equal: 'notEqual',
  notEqual: 'equal',
  less: 'greaterOrEqual',
  lessOrEqual: 'greater',
  greater: 'lessOrEqual',
  greaterOrEqual: 'less',
};

// Instructions that compute a value without any other effect.
const pure = new Set(['push', 'load', 'arithmetic', 'negate']);

const ALWAYS = { kind: 'Always' };

function liftError(message) {
  return new Error(`Cannot lift machine code: ${message}`);
}

const binary = (operator, left, right) => ({
  kind: 'Binary',
  operator,
  left,
  right,
});

function negate(condition) {
  if (condition.kind === 'Binary' && opposite[condition.operator]) {
    return { ...condition, operator: opposite[condition.operator] };
  }
  if (
    condition.kind === 'Binary' &&
    ['and', 'or'].includes(condition.operator)
  ) {
    return binary(
      condition.operator === 'and' ? 'or' : 'and',
      negate(condition.left),
      negate(condition.right)
    );
  }
  if (condition.kind === 'Unary' && condition.operator === 'not') {
    return condition.operand;
  }
  return { kind: 'Unary', operator: 'not', operand: condition };
}

const both = (left, right) =>
  right === ALWAYS ? left : binary('and', left, right);
const either = (left, right) =>
  right === ALWAYS ? ALWAYS : binary('or', left, right);

// The condition under which execution continues after the comparison "if
// test, jump to target" and later passes the end of the whole condition.
//   whenTarget: the condition at the target (false for the false label)
//   next:       the condition after the comparison
function fallThrough(test, whenTarget, next) {
  if (whenTarget === false) {
    return both(negate(test), next);
  }
  if (whenTarget === next) {
    return next;
  }
  if (whenTarget === ALWAYS) {
    return either(test, next);
  }
  // next = Y or P(target): reaching the target means P(target) decides.
  if (
    next.kind === 'Binary' &&
    next.operator === 'or' &&
    next.right === whenTarget
  ) {
    return either(both(negate(test), next.left), whenTarget);
  }
  if (
    next.kind === 'Binary' &&
    next.operator === 'and' &&
    next.right === whenTarget
  ) {
    return both(either(test, next.left), whenTarget);
  }
  return either(both(test, whenTarget), both(negate(test), next));
}

// The statements of one block while they are lifted: the symbolic stack,
// the names declared so far and the parts of a print without its newline.
class BlockLifting {
  constructor(lifting, outer) {
    this.lifting = lifting;
    this.scope = new Set(outer);
    this.statements = [];
    this.stack = [];
    this.prints = [];
  }

  pop() {
    if (!this.stack.length) {
      throw liftError('a statement needs a value on the stack');
    }
    return this.stack.pop();
  }

  flush(newline) {
    const { prints } = this;
    if (!prints.length && !newline) {
      return;
    }
    let value = { kind: 'Text', value: '' };
    if (prints.length === 1) {
      [value] = prints;
    } else if (prints.length) {
      value = { kind: 'Interpolation', parts: prints };
    }
    this.statements.push({ kind: 'Print', value, newline });
    this.prints = [];
  }

  add(statement) {
    this.flush(false);
    this.statements.push(statement);
  }

  store(name, value) {
    if (this.lifting.isBoolean(value)) {
      this.lifting.booleans.add(name);
    }
    if (this.scope.has(name)) {
      this.add({ kind: 'Assignment', name, operator: '=', value });
    } else {
      this.scope.add(name);
      this.add({ kind: 'Declaration', name, value });
    }
  }

  printText(value) {
    const last = this.prints.at(-1);
    if (last?.kind === 'Text') {
      this.prints[this.prints.length - 1] = {
        kind: 'Text',
        value: last.value + value,
      };
    } else {
      this.prints.push({ kind: 'Text', value });
    }
  }

  instruction(operation, operands) {
    const { lifting } = this;
    const statements = {
      comment: () => this.add({ kind: 'Comment', text: operands[0] }),
      store: () => this.store(lifting.names[operands[0]], this.pop()),
      pop: () => this.add({ kind: 'Evaluate', expression: this.pop() }),
      return: () => this.add({ kind: 'Return', value: this.pop() }),
      'return-nothing': () => this.add({ kind: 'Return' }),
      'print-integer': () => this.prints.push(this.pop()),
      'print-text': () => this.printText(operands[0]),
      'print-newline': () => this.flush(true),
      jump: () => {
        throw liftError(`an unexpected jump to "${operands[0]}"`);
      },
    };
    if (statements[operation]) {
      statements[operation]();
      return;
    }
    lifting.expression(this.stack, operation, operands);
    // A call to a procedure that returns nothing is a statement.
    if (operation === 'call' && !lifting.functions.get(operands[0])) {
      this.add({ kind: 'Evaluate', expression: this.stack.pop() });
    }
  }

  finish() {
    this.flush(false);
    if (this.stack.length) {
      throw liftError('values are left on the stack');
    }
    return { kind: 'Block', statements: countingLoops(this.statements) };
  }
}

class FunctionLifting {
  constructor(item, functions, booleanFunctions = new Set()) {
    this.item = item;
    this.functions = functions;
    this.booleanFunctions = booleanFunctions;
    this.code = item.code;
    this.names = item.slotNames.map(neutralName);
    this.labels = new Map();
    this.code.forEach(([operation, label], index) => {
      if (operation === 'label') {
        this.labels.set(label, index);
      }
    });
    this.booleans = new Set();
  }

  at(index) {
    return this.code[index] ?? [];
  }

  labelIndex(label) {
    if (!this.labels.has(label)) {
      throw liftError(`the label "${label}" is missing`);
    }
    return this.labels.get(label);
  }

  // Read a pure expression that ends with a comparison jump, starting at
  // index. Returns { test, target, next } or null.
  comparison(index, stack = []) {
    const values = [...stack];
    let position = index;
    for (;;) {
      const [operation, ...operands] = this.at(position);
      if (operation === 'compare-jump' && values.length === 2) {
        const [left, right] = values;
        return {
          test: this.relation(operands[0], left, right),
          target: operands[1],
          next: position + 1,
        };
      }
      if (pure.has(operation)) {
        this.expression(values, operation, operands);
      } else if (operation === 'call' && this.functions.get(operands[0])) {
        this.expression(values, operation, operands);
      } else {
        return null;
      }
      position += 1;
    }
  }

  // "flag != 0" is how lowering tests a boolean value.
  relation(operator, left, right) {
    if (
      right.kind === 'Number' &&
      right.value === 0 &&
      this.isBoolean(left) &&
      ['equal', 'notEqual'].includes(operator)
    ) {
      return operator === 'notEqual' ? left : negate(left);
    }
    return binary(operator, left, right);
  }

  isBoolean(expression) {
    if (expression.kind === 'Name') {
      return this.booleans.has(expression.name);
    }
    return isTruthValue(expression, this.booleanFunctions);
  }

  // Read the whole condition that starts with the comparison at index (or
  // with the comparison already read as first). Returns { condition, falseLabel, end }.
  condition(index, first) {
    const steps = [];
    const open = new Map();
    let best = null;
    let position = index;
    let comparison = first ?? this.comparison(position);
    if (!comparison) {
      throw liftError(`no condition at instruction ${index}`);
    }
    for (;;) {
      if (comparison) {
        steps.push({ ...comparison });
        open.set(comparison.target, (open.get(comparison.target) ?? 0) + 1);
        position = comparison.next;
      } else {
        const [, label] = this.at(position);
        steps.push({ label });
        open.delete(label);
        position += 1;
      }
      if (open.size === 1) {
        best = {
          steps: steps.length,
          end: position,
          falseLabel: [...open.keys()][0],
        };
      }
      const [operation, label] = this.at(position);
      if (operation === 'label' && open.has(label)) {
        comparison = null;
        continue;
      }
      comparison = this.comparison(position);
      if (!comparison) {
        break;
      }
    }
    if (!best) {
      throw liftError(
        `the condition at instruction ${index} has no single false label`
      );
    }
    return {
      ...best,
      condition: this.rebuild(steps.slice(0, best.steps), best.falseLabel),
    };
  }

  rebuild(steps, falseLabel) {
    const atLabel = new Map([[falseLabel, false]]);
    let next = ALWAYS;
    for (let index = steps.length - 1; index >= 0; index -= 1) {
      const step = steps[index];
      if (step.label) {
        atLabel.set(step.label, next);
        continue;
      }
      if (!atLabel.has(step.target)) {
        throw liftError(`the jump to "${step.target}" leaves the condition`);
      }
      next = fallThrough(step.test, atLabel.get(step.target), next);
    }
    if (next === ALWAYS) {
      throw liftError('a condition that is always true');
    }
    return next;
  }

  expression(stack, operation, operands) {
    const pop = () => {
      if (!stack.length) {
        throw liftError(`"${operation}" needs a value on the stack`);
      }
      return stack.pop();
    };
    switch (operation) {
      case 'push':
        stack.push({ kind: 'Number', value: operands[0] });
        return;
      case 'load':
        stack.push({ kind: 'Name', name: this.names[operands[0]] });
        return;
      case 'arithmetic': {
        const right = pop();
        stack.push(binary(operands[0], pop(), right));
        return;
      }
      case 'negate':
        stack.push({ kind: 'Unary', operator: 'negate', operand: pop() });
        return;
      case 'call': {
        const [callee, count] = operands;
        const callArguments = stack.splice(stack.length - count, count);
        if (callArguments.length !== count) {
          throw liftError(`the call to "${callee}" needs ${count} values`);
        }
        stack.push({
          kind: 'Call',
          callee: neutralName(callee),
          arguments: callArguments,
        });
        return;
      }
      default:
        throw liftError(`"${operation}" is not an expression`);
    }
  }

  // Lift the instructions in [start, end) into a block.
  block(start, end, outer) {
    const lifted = new BlockLifting(this, outer);
    let index = start;
    while (index < end) {
      const [operation, ...operands] = this.at(index);
      if (operation === 'label') {
        index = this.loop(index, lifted);
      } else if (operation === 'compare-jump') {
        const right = lifted.pop();
        const left = lifted.pop();
        const found = this.condition(index, {
          test: this.relation(operands[0], left, right),
          target: operands[1],
          next: index + 1,
        });
        if (this.isBooleanValue(found)) {
          lifted.stack.push(found.condition);
          index = found.end + 5;
        } else {
          index = this.branch(found, lifted);
        }
      } else {
        lifted.instruction(operation, operands);
        index += 1;
      }
    }
    return lifted.finish();
  }

  isBooleanValue({ end, falseLabel }) {
    const [one, jump, label, zero, done] = [0, 1, 2, 3, 4].map((offset) =>
      this.at(end + offset)
    );
    return (
      one[0] === 'push' &&
      one[1] === 1 &&
      jump[0] === 'jump' &&
      label[0] === 'label' &&
      label[1] === falseLabel &&
      zero[0] === 'push' &&
      zero[1] === 0 &&
      done[0] === 'label' &&
      done[1] === jump[1]
    );
  }

  // condition → O; then; jump D; label O; otherwise; label D
  branch({ condition, end, falseLabel }, lifted) {
    const otherwise = this.labelIndex(falseLabel);
    const [jump, done] = this.at(otherwise - 1);
    if (jump !== 'jump') {
      throw liftError(`the "if" before "${falseLabel}" has no jump to its end`);
    }
    const doneIndex = this.labelIndex(done);
    const then = this.block(end, otherwise - 1, lifted.scope);
    const rest = this.block(otherwise + 1, doneIndex, lifted.scope);
    const statement = { kind: 'If', condition, then };
    if (rest.statements.length === 1 && rest.statements[0].kind === 'If') {
      statement.otherwise = rest.statements[0];
    } else if (rest.statements.length) {
      statement.otherwise = rest;
    }
    lifted.add(statement);
    return doneIndex + 1;
  }

  // label T; condition → F; body; jump T; label F
  loop(index, lifted) {
    const [, top] = this.at(index);
    const found = this.condition(index + 1);
    const exit = this.labelIndex(found.falseLabel);
    const [jump, target] = this.at(exit - 1);
    if (jump !== 'jump' || target !== top) {
      throw liftError(`the label "${top}" does not start a loop`);
    }
    lifted.add({
      kind: 'While',
      condition: found.condition,
      body: this.block(found.end, exit - 1, lifted.scope),
    });
    return exit + 1;
  }

  lift() {
    const parameters = this.names.slice(0, this.item.parameterCount);
    const body = this.block(0, this.code.length, parameters);
    const last = body.statements.at(-1);
    if (last?.kind === 'Return' && !last.value) {
      body.statements.pop();
    }
    return {
      parameters: parameters.map((name) => ({ name, type: 'integer' })),
      body,
    };
  }
}

const isName = (expression, name) =>
  expression?.kind === 'Name' && expression.name === name;

const mentions = (tree, name) =>
  JSON.stringify(tree).includes(`"name":${JSON.stringify(name)}`);

// "i = start; while (i < end) { ...; i = i + 1 }" is a counting loop when
// the loop body does not change i otherwise and i is not used afterwards.
const isStep = (step, variable) =>
  step?.kind === 'Assignment' &&
  step.name === variable &&
  step.value.kind === 'Binary' &&
  step.value.operator === 'add' &&
  isName(step.value.left, variable) &&
  step.value.right.kind === 'Number' &&
  step.value.right.value === 1;

const isBound = (loop, variable) =>
  loop?.kind === 'While' &&
  loop.condition.kind === 'Binary' &&
  loop.condition.operator === 'less' &&
  isName(loop.condition.left, variable) &&
  !mentions(loop.condition.right, variable);

function isCountingLoop(start, loop, after) {
  const variable = start.name;
  if (
    start.kind !== 'Declaration' ||
    !isBound(loop, variable) ||
    !isStep(loop.body.statements.at(-1), variable)
  ) {
    return false;
  }
  const assigned = (identifier) =>
    JSON.stringify(loop.body.statements.slice(0, -1)).includes(
      `"kind":"Assignment","name":${JSON.stringify(identifier)}`
    );
  // A counting loop computes its bound once, so the body must not change it.
  const boundNames = [];
  walk(loop.condition.right, (current) => {
    if (current.kind === 'Name') {
      boundNames.push(current.name);
    }
  });
  return (
    !assigned(variable) &&
    !boundNames.some(assigned) &&
    !mentions(after, variable)
  );
}

export function countingLoops(statements) {
  const result = [];
  for (let index = 0; index < statements.length; index += 1) {
    const start = statements[index];
    const loop = statements[index + 1];
    if (!isCountingLoop(start, loop, statements.slice(index + 2))) {
      result.push(start);
      continue;
    }
    result.push({
      kind: 'CountingLoop',
      variable: start.name,
      start: start.value,
      end: loop.condition.right,
      body: { ...loop.body, statements: loop.body.statements.slice(0, -1) },
    });
    index += 1;
  }
  return result;
}

// A comparison, a logical operation or a call to a function that returns
// one. Machine code keeps all of them as the integers 0 and 1.
function isTruthValue(expression, booleanFunctions) {
  switch (expression.kind) {
    case 'Boolean':
      return true;
    case 'Unary':
      return expression.operator === 'not';
    case 'Call':
      return booleanFunctions.has(expression.callee);
    case 'Binary':
      return (
        Boolean(opposite[expression.operator]) ||
        ['and', 'or'].includes(expression.operator)
      );
    default:
      return false;
  }
}

// A function whose every returned value is a truth value returns a boolean.
function returnsTruthValue(body, booleanFunctions) {
  const values = [];
  walk(body, (current) => {
    if (current.kind === 'Return') {
      values.push(current.value);
    }
  });
  return (
    values.length > 0 &&
    values.every((value) => value && isTruthValue(value, booleanFunctions))
  );
}

// Lift a machine program read by machine-reader.js into a meta program
// before type inference.
export function liftProgram(machine) {
  const functions = new Map(
    machine.functions.map((item) => [item.name, item.returns])
  );
  // Machine code returns booleans as integers. Which functions return truth
  // values decides how their callers are read, so lifting repeats until
  // that set no longer changes.
  let booleanFunctions = new Set();
  const liftAll = () =>
    machine.functions.map((item) =>
      new FunctionLifting(item, functions, booleanFunctions).lift()
    );
  let lifted = liftAll();
  for (let round = 0; round <= machine.functions.length; round += 1) {
    const found = new Set(
      machine.functions
        .filter(
          (item, index) =>
            item.returns &&
            returnsTruthValue(lifted[index].body, booleanFunctions)
        )
        .map((item) => neutralName(item.name))
    );
    if (
      [...found].every((item) => booleanFunctions.has(item)) &&
      found.size === booleanFunctions.size
    ) {
      break;
    }
    booleanFunctions = found;
    lifted = liftAll();
  }
  const returnType = (item) => {
    if (!item.returns) {
      return 'nothing';
    }
    return booleanFunctions.has(neutralName(item.name)) ? 'boolean' : 'integer';
  };
  return {
    kind: 'Program',
    comments: machine.comments,
    imports: [],
    functions: machine.functions.map((item, index) => ({
      kind: 'Function',
      name: neutralName(item.name),
      ...lifted[index],
      returnType: returnType(item),
      comments: item.comments,
    })),
    main: new FunctionLifting(machine.main, functions, booleanFunctions).lift()
      .body,
    mainComments: machine.main.comments,
  };
}
