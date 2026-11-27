import { name, node, rewrite, walk } from '../meta/tree.js';
import { inheritOrigin } from '../translation/source-origins.js';

function bindings(tree, initial = []) {
  const names = new Set(initial);
  walk(tree, (current) => {
    if (['Declaration', 'Assignment', 'Catch'].includes(current.kind)) {
      names.add(current.name);
    } else if (['ForEach', 'CountingLoop'].includes(current.kind)) {
      names.add(current.variable);
    }
  });
  return names;
}

// Imported aliases identify the actual reflection procedure.
function importedBindings(imports) {
  const bindings = new Map();
  for (const line of imports) {
    const imported = /^import (.+)$/u.exec(line);
    const members = /^from ([\p{L}\p{N}_.]+) import (.+)$/u.exec(line);
    for (const entry of (members?.[2] ?? imported?.[1] ?? '').split(',')) {
      const match = /^\s*([\p{L}\p{N}_.]+)(?: as ([\p{L}\p{N}_]+))?\s*$/u.exec(
        entry
      );
      if (match) {
        bindings.set(
          match[2] ?? match[1].split('.')[0],
          members ? `${members[1]}.${match[1]}` : match[1]
        );
      }
    }
  }
  return bindings;
}

function sourceReaders(imports, shadowed) {
  const readers = new Set();
  for (const [local, qualified] of importedBindings(imports)) {
    if (!shadowed.has(local)) {
      if (qualified === 'inspect') {
        readers.add(`${local}.getsource`);
      } else if (qualified === 'inspect.getsource') {
        readers.add(local);
      }
    }
  }
  return readers;
}

const question = (aspect, subject, original) =>
  inheritOrigin(node('Question', { aspect, subject }), original);

function pythonQuestion(current, shadowed, readers) {
  if (current.kind === 'Name' && current.name.endsWith('.__doc__')) {
    return question('documentation', name(current.name.slice(0, -8)), current);
  }
  if (current.kind === 'Method' && current.name === '__doc__') {
    return question('documentation', current.receiver, current);
  }
  if (current.kind !== 'Call') {
    return current;
  }
  const args = current.arguments;
  if (args.length === 1) {
    if (current.callee === 'type' && !shadowed.has('type')) {
      return question('type', args[0], current);
    }
    if (readers.has(current.callee)) {
      return question('source', args[0], current);
    }
  }
  return detailedQuestion(current, shadowed);
}

function detailedQuestion(current, shadowed) {
  const args = current.arguments;
  if (
    !shadowed.has('get_ipython') &&
    current.callee === '.run_line_magic' &&
    args.length === 3 &&
    args[0].kind === 'Call' &&
    args[0].callee === 'get_ipython' &&
    !args[0].arguments.length &&
    args[1].kind === 'Text' &&
    args[1].value === 'pinfo2' &&
    args[2].kind === 'Text' &&
    /^[\p{L}_][\p{L}\p{N}_]*(?:\.[\p{L}_][\p{L}\p{N}_]*)*$/u.test(args[2].value)
  ) {
    return question('details', name(args[2].value), current);
  }
  return current;
}

function javascriptQuestion(current, shadowed) {
  if (
    current.kind === 'Call' &&
    current.callee === 'Function.prototype.toString.call' &&
    current.arguments.length === 1 &&
    !shadowed.has('Function')
  ) {
    return question('source', current.arguments[0], current);
  }
  if (
    current.kind === 'Method' &&
    current.name === 'constructor' &&
    current.receiver.kind === 'Call' &&
    current.receiver.callee === 'Object.getPrototypeOf' &&
    current.receiver.arguments.length === 1 &&
    !shadowed.has('Object')
  ) {
    return question('type', current.receiver.arguments[0], current);
  }
  // __doc__ is the portable documentation property written below. It is
  // separate from JavaScript comments, which do not exist at runtime.
  if (current.kind === 'Name' && current.name.endsWith('.__doc__')) {
    return question('documentation', name(current.name.slice(0, -8)), current);
  }
  if (current.kind === 'Method' && current.name === '__doc__') {
    return question('documentation', current.receiver, current);
  }
  return current;
}

export function recognizeQuestions(program, { from } = {}) {
  const python = from?.split('@')[0] === 'python';
  if (!python && !['javascript', 'typescript'].includes(from?.split('@')[0])) {
    return program;
  }
  const global = bindings(
    program.main,
    program.functions.map((item) => item.name)
  );
  const apply = (tree, shadowed) => {
    const readers = sourceReaders(program.imports, shadowed);
    const builtinShadowed = new Set([
      ...shadowed,
      ...importedBindings(program.imports).keys(),
    ]);
    return rewrite(tree, (current) =>
      python
        ? pythonQuestion(current, builtinShadowed, readers)
        : javascriptQuestion(current, shadowed)
    );
  };
  const result = program;
  return inheritOrigin(
    {
      ...result,
      functions: result.functions.map((item) =>
        inheritOrigin(
          {
            ...item,
            body: apply(
              item.body,
              bindings(item.body, [
                ...global,
                ...item.parameters.map((parameter) => parameter.name),
              ])
            ),
          },
          item
        )
      ),
      main: apply(result.main, global),
    },
    program
  );
}

export function writeQuestion(emitter, expression) {
  const { aspect, subject } = expression;
  const value = emitter.expression(subject);
  if (emitter.id === 'python') {
    if (aspect === 'type') {
      return `type(${value})`;
    }
    if (aspect === 'documentation') {
      return `(${value}).__doc__`;
    }
    if (aspect === 'source') {
      emitter.uses.add('inspect');
      return `inspect.getsource(${value})`;
    }
    if (aspect === 'details' && subject.kind === 'Name') {
      return `get_ipython().run_line_magic("pinfo2", ${emitter.quote(value)})`;
    }
  }
  if (['javascript', 'typescript'].includes(emitter.id)) {
    if (aspect === 'type') {
      return `Object.getPrototypeOf(${value}).constructor`;
    }
    if (aspect === 'documentation') {
      return `(${value}).__doc__`;
    }
    if (aspect === 'source') {
      return `Function.prototype.toString.call(${value})`;
    }
  }
  throw new Error(`Cannot emit a ${aspect} question in ${emitter.syntax.id}`);
}

export function writePropertyAccess(emitter, expression) {
  if (!['python', 'javascript', 'typescript'].includes(emitter.id)) {
    throw new Error(`Cannot emit property access in ${emitter.syntax.id}`);
  }
  return `(${emitter.expression(expression.receiver)}).${expression.name}`;
}
