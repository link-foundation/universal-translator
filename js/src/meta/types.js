// Type inference for the meta language. Statically typed targets need a
// type for every variable, parameter and result; untyped sources do not
// write them down, so the types are derived from literals, operators,
// declarations and call sites. Meta types: integer, real, text, boolean,
// nothing, and array (a fixed-length array of integers). A variable that
// is given a real after an integer start is a real variable.

import { rewrite, walk } from './tree.js';
import { inheritOrigin } from '../translation/source-origins.js';

const comparisons = new Set([
  'equal',
  'notEqual',
  'less',
  'lessOrEqual',
  'greater',
  'greaterOrEqual',
  'and',
  'or',
]);

// Kinds whose type does not depend on their parts.
const fixedTypes = new Map([
  ['Text', 'text'],
  ['Interpolation', 'text'],
  ['Boolean', 'boolean'],
  ['ArrayLiteral', 'array'],
  ['NewArray', 'array'],
  ['Index', 'integer'],
  ['Length', 'integer'],
]);

function binaryType(expression, scope, signatures) {
  if (comparisons.has(expression.operator)) {
    return 'boolean';
  }
  const left = expressionType(expression.left, scope, signatures);
  const right = expressionType(expression.right, scope, signatures);
  if (expression.operator === 'add' && (left === 'text' || right === 'text')) {
    return 'text';
  }
  return expression.operator === 'realDivide' ||
    (expression.operator === 'power' &&
      (expression.right.kind !== 'Number' || expression.right.value < 0)) ||
    left === 'real' ||
    right === 'real'
    ? 'real'
    : 'integer';
}

const numberType = ({ type, value }) =>
  type === 'real' || !Number.isInteger(value) ? 'real' : 'integer';

function expressionType(expression, scope, signatures) {
  if (fixedTypes.has(expression.kind)) {
    return fixedTypes.get(expression.kind);
  }
  switch (expression.kind) {
    case 'Number':
      return numberType(expression);
    case 'Name':
      return scope.get(expression.name);
    case 'Unary':
      if (expression.operator === 'not') {
        return 'boolean';
      }
      return expressionType(expression.operand, scope, signatures) === 'real'
        ? 'real'
        : 'integer';
    case 'Binary':
      return binaryType(expression, scope, signatures);
    case 'Call':
      return signatures.get(expression.callee)?.returnType;
    default:
      return undefined;
  }
}

// A division with a real operand is a true division (C's `7.0 / 2`).
function annotate(expression, scope, signatures) {
  return rewrite(expression, (current) => {
    const type = expressionType(current, scope, signatures);
    const operator =
      current.kind === 'Binary' &&
      current.operator === 'divide' &&
      type === 'real'
        ? 'realDivide'
        : current.operator;
    if (!type) {
      return current;
    }
    return operator ? { ...current, operator, type } : { ...current, type };
  });
}

function typeBlock(body, scope, signatures, returns) {
  const local = new Map(scope);
  local.reals = scope.reals;
  const statements = body.statements.map((statement) =>
    typeStatement(statement, local, signatures, returns)
  );
  return inheritOrigin({ ...body, statements }, body);
}

// An integer literal stored in a real variable is a real literal (0 is 0.0).
const stored = (value, type) =>
  type === 'real' && value?.kind === 'Number' && value.type === 'integer'
    ? { ...value, type: 'real' }
    : value;

function declare(statement, value, type, context) {
  context.scope.set(statement.name, type);
  return { ...statement, type, value: stored(value, type) };
}

// One small typing rule per statement kind. `context` holds the variable
// scope, the function signatures and the types of the returned values.
const statementTypers = {
  Declaration(statement, context) {
    const value = context.typed(statement.value);
    const type = known(statement.type) ?? value?.type ?? 'integer';
    const promoted =
      type === 'integer' &&
      context.reals.has(statement.name) &&
      !context.reals.declared.has(statement.name);
    if (promoted) {
      return declare(statement, value, 'real', context);
    }
    return declare(statement, value, type, context);
  },
  Assignment(statement, context) {
    const value = context.typed(statement.value);
    if (
      value?.type === 'real' &&
      context.scope.get(statement.name) === 'integer'
    ) {
      context.reals.add(statement.name);
    }
    return {
      ...statement,
      value: stored(value, context.scope.get(statement.name)),
    };
  },
  IndexAssignment: (statement, context) => ({
    ...statement,
    index: context.typed(statement.index),
    value: context.typed(statement.value),
  }),
  Print: (statement, context) => ({
    ...statement,
    value: context.typed(statement.value),
  }),
  Evaluate: (statement, context) => ({
    ...statement,
    expression: context.typed(statement.expression),
  }),
  Throw: (statement, context) => ({
    ...statement,
    value: context.typed(statement.value),
  }),
  Try(statement, context) {
    return {
      ...statement,
      body: context.block(statement.body),
      handlers: statement.handlers.map((handler) => {
        const inner = new Map(context.scope);
        inner.reals = context.reals;
        if (handler.name) {
          inner.set(handler.name, handler.type ?? 'integer');
        }
        return {
          ...handler,
          body: typeBlock(
            handler.body,
            inner,
            context.signatures,
            context.returns
          ),
        };
      }),
      success: statement.success && context.block(statement.success),
      finalizer: statement.finalizer && context.block(statement.finalizer),
    };
  },
  Return(statement, context) {
    const value = context.typed(statement.value);
    context.returns.push(value?.type ?? 'nothing');
    return { ...statement, value };
  },
  If(statement, context) {
    const { otherwise } = statement;
    return {
      ...statement,
      condition: context.typed(statement.condition),
      then: context.block(statement.then),
      otherwise:
        otherwise &&
        (otherwise.kind === 'If'
          ? typeStatement(
              otherwise,
              context.scope,
              context.signatures,
              context.returns
            )
          : context.block(otherwise)),
    };
  },
  While: (statement, context) => ({
    ...statement,
    condition: context.typed(statement.condition),
    body: context.block(statement.body),
  }),
  ForEach(statement, context) {
    const inner = new Map(context.scope);
    inner.set(statement.variable, 'integer');
    return {
      ...statement,
      type: 'integer',
      array: context.typed(statement.array),
      body: typeBlock(
        statement.body,
        inner,
        context.signatures,
        context.returns
      ),
    };
  },
  CountingLoop(statement, context) {
    const inner = new Map(context.scope);
    inner.reals = context.reals;
    inner.set(statement.variable, 'integer');
    return {
      ...statement,
      start: context.typed(statement.start),
      end: context.typed(statement.end),
      body: typeBlock(
        statement.body,
        inner,
        context.signatures,
        context.returns
      ),
    };
  },
};

function typeStatement(statement, scope, signatures, returns) {
  const typer = statementTypers[statement.kind];
  if (!typer) {
    return statement;
  }
  return inheritOrigin(
    typer(statement, {
      scope,
      reals: scope.reals,
      signatures,
      returns,
      typed: (expression) =>
        expression && annotate(expression, scope, signatures),
      block: (body) => typeBlock(body, scope, signatures, returns),
    }),
    statement
  );
}

function known(type) {
  return type || undefined;
}

// Parameter types come from the first call site that tells them.
function callSiteTypes(program, signatures) {
  const found = new Map();
  rewrite(program, (current) => {
    if (current.kind === 'Call' && signatures.has(current.callee)) {
      const types = found.get(current.callee) ?? [];
      current.arguments.forEach((argument, index) => {
        types[index] ??= argument.type;
      });
      found.set(current.callee, types);
    }
    return current;
  });
  return found;
}

// The variables whose type the source writes down.
function declaredNames(body) {
  const names = new Set();
  walk(body, (current) => {
    if (current.kind === 'Declaration' && known(current.type)) {
      names.add(current.name);
    }
  });
  return names;
}

// The result type of a function: the declared one, otherwise the type of
// its returned values, a real where one of them is real.
function returnType(signature, returns) {
  if (signature.declared) {
    return signature.declared;
  }
  const values = returns.filter((type) => type && type !== 'nothing');
  if (values.includes('real')) {
    return 'real';
  }
  return signature.returnType ?? values[0];
}

export function inferTypes(program) {
  const signatures = new Map(
    program.functions.map((item) => [
      item.name,
      {
        parameters: item.parameters.map((parameter) => known(parameter.type)),
        returnType: known(item.returnType),
      },
    ])
  );
  // The variables of each function that are given a real.
  const promoted = new Map();
  const reals = (owner, body) => {
    if (!promoted.has(owner)) {
      const found = new Set();
      found.declared = declaredNames(body);
      promoted.set(owner, found);
    }
    return promoted.get(owner);
  };
  for (const item of program.functions) {
    signatures.get(item.name).declared = known(item.returnType);
  }
  let current = program;
  // Recursive functions need a few rounds before every type settles.
  for (let round = 0; round < 4; round += 1) {
    const functions = current.functions.map((item) => {
      const signature = signatures.get(item.name);
      const scope = new Map(
        item.parameters.map((parameter, index) => [
          parameter.name,
          signature.parameters[index] ?? 'integer',
        ])
      );
      scope.reals = reals(`function ${item.name}`, item.body);
      const returns = [];
      const body = typeBlock(item.body, scope, signatures, returns);
      signature.returnType = returnType(signature, returns);
      return inheritOrigin({ ...item, body }, item);
    });
    const top = new Map();
    top.reals = reals('main', current.main);
    const main = typeBlock(current.main, top, signatures, []);
    current = { ...current, functions, main };
    const sites = callSiteTypes(current, signatures);
    for (const [callee, types] of sites) {
      const signature = signatures.get(callee);
      signature.parameters = signature.parameters.map(
        (type, index) => type ?? types[index]
      );
    }
  }
  return {
    ...current,
    functions: current.functions.map((item) => {
      const signature = signatures.get(item.name);
      return inheritOrigin(
        {
          ...item,
          returnType: signature.returnType ?? 'nothing',
          parameters: item.parameters.map((parameter, index) => ({
            ...parameter,
            type: signature.parameters[index] ?? 'integer',
          })),
        },
        item
      );
    }),
  };
}
