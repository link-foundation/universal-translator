// Interpret the documented Portable Object Compiler string/set messages.
// Unknown messages remain explicit; they are never guessed from a whole program.
import { block, name, node, number, rewrite, walk } from '../meta/tree.js';
import { usedNames } from '../meta/for-each.js';
import { inheritOrigin } from '../translation/source-origins.js';

const binary = (operator, left, right) =>
  node('Binary', { operator, left, right });
const isMessage = (value, receiver, selector) =>
  value?.kind === 'Message' &&
  value.receiver.kind === 'Name' &&
  value.receiver.name === receiver &&
  value.selector === selector;
const sourceType = (value, scope) =>
  value?.kind === 'ProcessArguments'
    ? 'array<text>'
    : value?.kind === 'SetLiteral'
      ? 'set<text>'
      : value?.kind === 'Text'
        ? 'text'
        : value?.kind === 'Index' &&
            sourceType(value.array, scope) === 'array<text>'
          ? 'text'
          : value?.kind === 'Name'
            ? scope.get(value.name)
            : value?.kind === 'SetInsert'
              ? sourceType(value.collection, scope)
              : undefined;

function libraryStatements(current, scope) {
  const key = current.kind === 'Block' ? 'statements' : 'items';
  const local = new Map(scope);
  const statements = current[key].map((statement) => {
    const result = libraryNode(statement, local);
    if (['Declaration', 'Assignment'].includes(result.kind)) {
      local.set(result.name, sourceType(result.value, local));
    }
    return result;
  });
  return { ...current, [key]: statements };
}

function libraryFunction(current, scope) {
  const local = new Map(scope);
  for (const parameter of current.parameters) {
    local.set(parameter.name, parameter.type);
  }
  return { ...current, body: libraryNode(current.body, local) };
}

function libraryForEach(current, scope) {
  const array = libraryNode(current.array, scope);
  const local = new Map(scope).set(
    current.variable,
    sourceType(array, scope) === 'set<text>' ? 'text' : undefined
  );
  return { ...current, array, body: libraryNode(current.body, local) };
}

function libraryIteration(current, scope) {
  const message = current.expression;
  if (message.kind !== 'Message' || message.selector !== 'do:') {
    return undefined;
  }
  const receiver = libraryNode(message.receiver, scope);
  const lambda = message.arguments[0];
  if (
    sourceType(receiver, scope) !== 'set<text>' ||
    lambda?.kind !== 'BlockLambda' ||
    lambda.parameters.length !== 1
  ) {
    return undefined;
  }
  const variable = lambda.parameters[0];
  return node('ForEach', {
    variable,
    array: receiver,
    body: libraryNode(lambda.body, new Map(scope).set(variable, 'text')),
  });
}

function libraryMethod(result, scope) {
  const args = result.arguments;
  const dot = result.callee.lastIndexOf('.');
  const method = result.callee.slice(dot + 1);
  const receiver = dot === 0 ? args[0] : name(result.callee.slice(0, dot));
  const arguments_ = dot === 0 ? args.slice(1) : args;
  if (dot < 0) {
    return result;
  }
  const type = sourceType(receiver, scope);
  if (type === 'set<text>') {
    if (method === 'add' && arguments_.length === 1) {
      return node('SetInsert', { collection: receiver, value: arguments_[0] });
    }
    if (['clone', 'iter'].includes(method) && !arguments_.length) {
      return receiver;
    }
  }
  return method === 'to_owned' && !arguments_.length && type === 'text'
    ? receiver
    : result;
}

function libraryCall(result, scope) {
  const args = result.arguments;
  const constructor = result.callee
    .replace(/^new /u, '')
    .replace(/::new$/u, '');
  if (!args.length && scope.get(constructor) === 'objpak-constructor') {
    return node('SetLiteral', { elements: [], order: 'objpak-string' });
  }
  if (
    result.callee === 'process.argv.slice' &&
    !scope.has('process') &&
    args.length === 1 &&
    args[0].kind === 'Number' &&
    [1, 2].includes(args[0].value)
  ) {
    return node('ProcessArguments', { includeProgram: args[0].value === 1 });
  }
  return libraryMethod(result, scope);
}

function stringConstructor(result, scope) {
  if (
    !isMessage(result, 'String', 'str:') ||
    scope.has('String') ||
    result.arguments.length !== 1
  ) {
    return undefined;
  }
  const value = result.arguments[0];
  // argv entries and literals have C string termination. Other conversions
  // retain their message until their contract is modeled.
  if (value.kind === 'Text') {
    return { ...value, value: value.value.split('\0')[0] };
  }
  if (
    value.kind === 'Index' &&
    value.array.kind === 'Name' &&
    scope.get(value.array.name) === 'array<text>'
  ) {
    return value;
  }
  return undefined;
}

function instanceMessage(result, scope) {
  const type = sourceType(result.receiver, scope);
  const args = result.arguments;
  if (type === 'array<text>') {
    if (result.selector === 'size' && !args.length) {
      return node('Length', { array: result.receiver });
    }
    if (result.selector === 'at:' && args.length === 1) {
      return node('Index', { array: result.receiver, index: args[0] });
    }
  }
  if (result.selector === 'str' && !args.length && type === 'text') {
    return result.receiver;
  }
  if (result.selector === 'add:' && args.length === 1 && type === 'set<text>') {
    return node('SetInsert', { collection: result.receiver, value: args[0] });
  }
  return result;
}

function libraryMessage(result, scope) {
  if (
    isMessage(result, 'Set', 'new') &&
    !scope.has('Set') &&
    !result.arguments.length
  ) {
    return node('SetLiteral', { elements: [], order: 'objpak-string' });
  }
  return stringConstructor(result, scope) ?? instanceMessage(result, scope);
}

function postfixUpdate(result) {
  // Python postfix updates use the incremented value adjusted by one.
  return result.left.kind === 'Update' &&
    result.left.prefix &&
    result.right.kind === 'Number' &&
    result.right.value === 1 &&
    result.operator === (result.left.delta === 1 ? 'subtract' : 'add')
    ? { ...result.left, prefix: false }
    : result;
}

const expressionRules = {
  Name: (result, scope) =>
    result.name === 'sys.argv' && !scope.has('sys')
      ? node('ProcessArguments', { includeProgram: true })
      : result,
  Call: libraryCall,
  Binary: postfixUpdate,
  Message: libraryMessage,
  Declaration: (result, scope) =>
    result.type === 'source:id'
      ? { ...result, type: sourceType(result.value, scope) }
      : result,
};
const scopedRules = {
  Block: libraryStatements,
  SourceProgram: libraryStatements,
  Function: libraryFunction,
  ForEach: libraryForEach,
  Evaluate: libraryIteration,
};

function libraryNode(current, scope) {
  const scoped = scopedRules[current.kind]?.(current, scope);
  if (scoped) {
    return inheritOrigin(scoped, current);
  }
  const child = (value) =>
    Array.isArray(value)
      ? value.map(child)
      : value?.kind
        ? libraryNode(value, scope)
        : value;
  const result = Object.fromEntries(
    Object.entries(current).map(([key, value]) => [key, child(value)])
  );
  return inheritOrigin(
    expressionRules[result.kind]?.(result, scope) ?? result,
    current
  );
}

function processEntry(item, bindings = []) {
  if (
    item.kind !== 'Function' ||
    item.name !== 'main' ||
    item.parameters.length !== 2
  ) {
    return item;
  }
  const [count, pointer] = item.parameters;
  if (
    count.type !== 'integer' ||
    !/^source:char\s*\*\s*\*$/u.test(pointer.type)
  ) {
    return item;
  }
  let normalized = false;
  const recognizedBody = rewrite(item.body, (current) => {
    if (
      current.kind === 'Call' &&
      bindings.includes(current.callee) &&
      current.arguments.length === 3 &&
      current.arguments[0].kind === 'Name' &&
      current.arguments[0].name === count.name &&
      current.arguments[1].kind === 'Name' &&
      current.arguments[1].name === pointer.name &&
      current.arguments[2].kind === 'Number' &&
      [0, 1].includes(current.arguments[2].value)
    ) {
      normalized = true;
      return node('ProcessArguments', {
        includeProgram: current.arguments[2].value === 1,
      });
    }
    return current;
  });
  if (normalized) {
    let hasParameters = false;
    walk(recognizedBody, (current) => {
      if (
        current.kind === 'Name' &&
        [count.name, pointer.name].includes(current.name)
      ) {
        hasParameters = true;
      }
    });
    if (hasParameters) {
      throw new Error(
        'A normalized argument entry cannot reuse its native parameters'
      );
    }
    return { ...item, body: recognizedBody };
  }
  const used = usedNames(item.body, item.parameters);
  let args = 'processArguments';
  while (used.has(args)) {
    args += '_';
  }
  const validPointer = (operand) =>
    (operand?.kind === 'Name' && operand.name === pointer.name) ||
    (operand?.kind === 'Update' &&
      operand.operand.kind === 'Name' &&
      operand.operand.name === pointer.name);
  const validate = (current, parent) => {
    if (
      current.kind === 'Name' &&
      current.name === pointer.name &&
      !(
        (parent?.kind === 'Dereference' || parent?.kind === 'Update') &&
        validPointer(current)
      )
    ) {
      throw new Error(
        'Command-line pointers support dereferencing and integer cursor updates'
      );
    }
    for (const value of Object.values(current)) {
      if (Array.isArray(value)) {
        value
          .filter((part) => part?.kind)
          .forEach((part) => validate(part, current));
      } else if (value?.kind) {
        validate(value, current);
      }
    }
  };
  validate(item.body);
  const body = rewrite(item.body, (current) =>
    current.kind === 'Dereference' && validPointer(current.operand)
      ? node('Index', { array: name(args), index: current.operand })
      : current
  );
  const declaration = (identifier, type, value) =>
    node('Declaration', { name: identifier, type, value });
  return {
    ...item,
    body: block([
      declaration(
        args,
        'array<text>',
        node('ProcessArguments', { includeProgram: true })
      ),
      declaration(count.name, 'integer', node('Length', { array: name(args) })),
      declaration(pointer.name, 'integer', number(0)),
      ...body.statements,
    ]),
  };
}

export function recognizeObjpak(program, { from } = {}) {
  const language = from?.split('@')[0];
  if (
    language !== 'objc' &&
    !['python', 'javascript', 'rust'].includes(language)
  ) {
    return program;
  }
  const { objpakBindings = [], ...prepared } = program;
  if (language === 'objc') {
    prepared.items = program.items.map((item) =>
      processEntry(item, objpakBindings)
    );
  }
  const understood = libraryNode(
    prepared,
    new Map(objpakBindings.map((binding) => [binding, 'objpak-constructor']))
  );
  if (language !== 'objc') {
    return understood;
  }
  return rewrite(understood, (current) => {
    const condition = current.condition;
    const boolean =
      condition?.kind === 'Boolean' ||
      (condition?.kind === 'Binary' &&
        [
          'equal',
          'notEqual',
          'less',
          'lessOrEqual',
          'greater',
          'greaterOrEqual',
          'and',
          'or',
        ].includes(condition.operator)) ||
      (condition?.kind === 'Unary' && condition.operator === 'not');
    if (['While', 'If'].includes(current.kind) && !boolean) {
      return {
        ...current,
        condition: binary('notEqual', current.condition, number(0)),
      };
    }
    return current;
  });
}
