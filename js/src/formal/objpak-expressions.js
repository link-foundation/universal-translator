import { objpakRuntime } from './objpak-runtime.js';

function processArguments(writer, expression) {
  if (writer.syntax.id === 'objc') {
    writer.uses.add('objpak-set');
    return `${writer.objpakName}(${writer.objpakNativeCount}, ${writer.objpakNativeArgs}, ${expression.includeProgram ? 1 : 0})`;
  }
  const code = {
    python: expression.includeProgram ? 'sys.argv' : 'sys.argv[1:]',
    javascript: `process.argv.slice(${expression.includeProgram ? 1 : 2})`,
    rust: `std::env::args()${expression.includeProgram ? '' : '.skip(1)'}.collect::<Vec<String>>()`,
  }[writer.id];
  if (!code) {
    throw new Error(
      `${writer.syntax.label} has no command-line argument emitter`
    );
  }
  if (writer.id === 'python') {
    writer.uses.add('sys');
  }
  return code;
}

function pythonUpdate(writer, expression, variable, operator) {
  if (['2', '3.5'].includes(writer.syntax.version)) {
    throw new Error(
      'Update expressions require Python 3.8 assignment expressions'
    );
  }
  const updated = `(${variable} := ${variable} ${operator} 1)`;
  return expression.prefix
    ? updated
    : `(${updated} ${operator === '+' ? '-' : '+'} 1)`;
}

function update(writer, expression) {
  if (expression.operand.kind !== 'Name') {
    throw new Error('Update expressions require a numeric variable');
  }
  const variable = writer.variable(expression.operand.name);
  const operator = { 1: '+', '-1': '-' }[expression.delta];
  if (!operator) {
    throw new Error('Update expressions require a unit step');
  }
  if (writer.id === 'python') {
    return pythonUpdate(writer, expression, variable, operator);
  }
  if (writer.id === 'rust') {
    const previous = variable === 'previous' ? 'previous_' : 'previous';
    return expression.prefix
      ? `{ ${variable} ${operator}= 1; ${variable} }`
      : `{ let ${previous} = ${variable}; ${variable} ${operator}= 1; ${previous} }`;
  }
  if (
    ['c', 'cpp', 'csharp', 'java', 'javascript', 'typescript'].includes(
      writer.id
    )
  ) {
    return `(${expression.prefix ? operator.repeat(2) : ''}${variable}${expression.prefix ? '' : operator.repeat(2)})`;
  }
  throw new Error(`${writer.syntax.label} has no update expression emitter`);
}

function setLiteral(writer, expression) {
  if (expression.order !== 'objpak-string' || expression.elements.length) {
    throw new Error('Objpak set emission requires an empty string set');
  }
  if (writer.syntax.id === 'objc') {
    writer.uses.add('objpak');
    return '[Set new]';
  }
  if (!objpakRuntime[writer.id]) {
    throw new Error(`${writer.syntax.label} has no Objpak set emitter`);
  }
  if (writer.id === 'javascript' && !writer.syntax.forEach) {
    throw new Error('Objpak set emission requires ECMAScript 2015');
  }
  writer.uses.add('objpak-set');
  return writer.id === 'rust'
    ? `${writer.objpakName}::new()`
    : `${writer.id === 'python' ? '' : 'new '}${writer.objpakName}()`;
}

function setInsert(writer, expression) {
  const collection = writer.expression(expression.collection);
  const value = writer.expression(expression.value);
  if (writer.syntax.id === 'objc') {
    writer.uses.add('objpak');
    return `[${collection} add:[String str:${value}]]`;
  }
  return `${collection}.add(${writer.id === 'rust' ? `(${value}).to_owned()` : value})`;
}

const expressions = {
  ProcessArguments: processArguments,
  Update: update,
  SetLiteral: setLiteral,
  SetInsert: setInsert,
  Name(writer, expression) {
    if (
      writer.syntax.id === 'objc' &&
      writer.objpakTextObjects.has(expression.name)
    ) {
      return `[${writer.variable(expression.name)} str]`;
    }
    return writer.id === 'rust' && expression.type === 'set<text>'
      ? `${writer.variable(expression.name)}.clone()`
      : undefined;
  },
  Length: (writer, expression) =>
    writer.syntax.id === 'objc' && expression.array.type === 'array<text>'
      ? `[${writer.expression(expression.array)} size]`
      : undefined,
  Index: (writer, expression) =>
    writer.syntax.id === 'objc' && expression.array.type === 'array<text>'
      ? `[[${writer.expression(expression.array)} at:${writer.expression(expression.index)}] str]`
      : undefined,
};

export const objpakExpression = (writer, expression) =>
  expressions[expression.kind]?.(writer, expression);
