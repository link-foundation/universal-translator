// Type inference for the meta language. Statically typed targets need a
// type for every variable, parameter and result; untyped sources do not
// write them down, so the types are derived from literals, operators,
// declarations and call sites. Meta types: integer, text, boolean, nothing.

import { rewrite } from './meta.js';

const comparisons = new Set(['equal', 'notEqual', 'less', 'lessOrEqual', 'greater', 'greaterOrEqual', 'and', 'or']);

function expressionType(expression, scope, signatures) {
  switch (expression.kind) {
    case 'Number':
      return 'integer';
    case 'Text':
    case 'Interpolation':
      return 'text';
    case 'Boolean':
      return 'boolean';
    case 'Name':
      return scope.get(expression.name);
    case 'Unary':
      return expression.operator === 'not' ? 'boolean' : 'integer';
    case 'Binary': {
      if (comparisons.has(expression.operator)) return 'boolean';
      const left = expressionType(expression.left, scope, signatures);
      const right = expressionType(expression.right, scope, signatures);
      if (expression.operator === 'add' && (left === 'text' || right === 'text')) return 'text';
      return 'integer';
    }
    case 'Call':
      return signatures.get(expression.callee)?.returnType;
    default:
      return undefined;
  }
}

function annotate(expression, scope, signatures) {
  return rewrite(expression, (current) => {
    const type = expressionType(current, scope, signatures);
    return type ? { ...current, type } : current;
  });
}

function typeBlock(body, scope, signatures, returns) {
  const local = new Map(scope);
  const statements = body.statements.map((statement) => typeStatement(statement, local, signatures, returns));
  return { ...body, statements };
}

function typeStatement(statement, scope, signatures, returns) {
  const typed = (expression) => expression && annotate(expression, scope, signatures);
  switch (statement.kind) {
    case 'Declaration': {
      const value = typed(statement.value);
      const type = statement.type && !statement.type.startsWith('source:') ? statement.type : (value?.type ?? 'integer');
      scope.set(statement.name, type);
      return { ...statement, type, value };
    }
    case 'Assignment':
      return { ...statement, value: typed(statement.value) };
    case 'Return': {
      const value = typed(statement.value);
      returns.push(value?.type ?? 'nothing');
      return { ...statement, value };
    }
    case 'Print':
      return { ...statement, value: typed(statement.value) };
    case 'Evaluate':
      return { ...statement, expression: typed(statement.expression) };
    case 'If':
      return {
        ...statement,
        condition: typed(statement.condition),
        then: typeBlock(statement.then, scope, signatures, returns),
        otherwise: statement.otherwise && (statement.otherwise.kind === 'If' ? typeStatement(statement.otherwise, scope, signatures, returns) : typeBlock(statement.otherwise, scope, signatures, returns)),
      };
    case 'While':
      return { ...statement, condition: typed(statement.condition), body: typeBlock(statement.body, scope, signatures, returns) };
    case 'CountingLoop': {
      const inner = new Map(scope);
      inner.set(statement.variable, 'integer');
      return { ...statement, start: typed(statement.start), end: typed(statement.end), body: typeBlock(statement.body, inner, signatures, returns) };
    }
    default:
      return statement;
  }
}

function known(type) {
  return type && !type.startsWith('source:') ? type : undefined;
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

export function inferTypes(program) {
  const signatures = new Map(
    program.functions.map((item) => [
      item.name,
      { parameters: item.parameters.map((parameter) => known(parameter.type)), returnType: known(item.returnType) },
    ])
  );
  let current = program;
  // Recursive functions need a few rounds before every type settles.
  for (let round = 0; round < 4; round += 1) {
    const functions = current.functions.map((item) => {
      const signature = signatures.get(item.name);
      const scope = new Map(item.parameters.map((parameter, index) => [parameter.name, signature.parameters[index] ?? 'integer']));
      const returns = [];
      const body = typeBlock(item.body, scope, signatures, returns);
      signature.returnType ??= returns.find((type) => type && type !== 'nothing') ?? (returns.length || round > 0 ? undefined : undefined);
      return { ...item, body };
    });
    const main = typeBlock(current.main, new Map(), signatures, []);
    current = { ...current, functions, main };
    const sites = callSiteTypes(current, signatures);
    for (const [callee, types] of sites) {
      const signature = signatures.get(callee);
      signature.parameters = signature.parameters.map((type, index) => type ?? types[index]);
    }
  }
  return {
    ...current,
    functions: current.functions.map((item) => {
      const signature = signatures.get(item.name);
      return {
        ...item,
        returnType: signature.returnType ?? 'nothing',
        parameters: item.parameters.map((parameter, index) => ({ ...parameter, type: signature.parameters[index] ?? 'integer' })),
      };
    }),
  };
}
