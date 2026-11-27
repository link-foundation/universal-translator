// A declarative selection has a source, scoped row, predicate and projection.
import { name, rewrite, walk } from '../meta/tree.js';
import { rewriteFree } from '../meta/queries.js';

function csharpQueryNames(program) {
  const used = new Set();
  const occupied = new Set();
  let hasQuery = false;
  walk(program, (current) => {
    if (current.name) {
      occupied.add(current.name);
    }
    if (current.kind === 'Call') {
      occupied.add(current.callee.split('.')[0]);
    }
    if (['Declaration', 'Parameter', 'Catch'].includes(current.kind)) {
      used.add(current.name);
    }
    if (['ForEach', 'CountingLoop'].includes(current.kind)) {
      used.add(current.variable);
    }
    if (current.kind === 'Query') {
      hasQuery = true;
      occupied.add(current.variable);
    }
    if (current.kind === 'Function') {
      current.parameters.forEach((p) => used.add(p.name));
    }
  });
  if (!hasQuery) {
    return program;
  }
  return rewrite(program, (current) => {
    if (current.kind !== 'Query') {
      return current;
    }
    const variable = current.variable;
    walk(current.source, (item) => {
      if (item.kind === 'Name' && item.name === variable) {
        used.add(variable);
      }
    });
    let fresh = variable;
    for (let suffix = 2; used.has(fresh); suffix++) {
      fresh = `${variable}Query${suffix}`;
      while (occupied.has(fresh)) {
        fresh = `${fresh}_`;
      }
    }
    used.add(fresh);
    occupied.add(fresh);
    const rename = (expression) =>
      rewriteFree(expression, variable, (item) => {
        if (item.kind === 'Name' && item.name === variable) {
          return name(fresh);
        }
        if (
          item.kind === 'Call' &&
          (item.callee === variable || item.callee.startsWith(`${variable}.`))
        ) {
          return {
            ...item,
            callee: fresh + item.callee.slice(variable.length),
          };
        }
        return item;
      });
    return fresh === variable
      ? current
      : {
          ...current,
          variable: fresh,
          condition: rename(current.condition),
          projection: rename(current.projection),
        };
  });
}

function querySource(emitter, source) {
  if (emitter.id === 'csharp' && source.kind === 'ArrayLiteral') {
    return source.elements.length
      ? `new[] ${emitter.expression(source)}`
      : 'new int[0]';
  }
  return emitter.expression(source);
}

export function writeQuery(emitter, expression) {
  const { source, variable, condition, projection, eager } = expression;
  const row = emitter.variable(variable);
  const from = querySource(emitter, source);
  const selected = emitter.expression(projection);
  const filtered = !(condition.kind === 'Boolean' && condition.value);
  const predicate = filtered ? emitter.expression(condition) : '';
  switch (emitter.id) {
    case 'python': {
      const body = `${selected} for ${row} in ${from}${filtered ? ` if ${predicate}` : ''}`;
      return eager ? `[${body}]` : `(${body})`;
    }
    case 'javascript':
    case 'typescript': {
      if (emitter.id === 'javascript' && !emitter.syntax.forEach) {
        throw new Error(
          'Query emission requires ECMAScript 2015 arrow functions'
        );
      }
      if (!eager) {
        throw new Error('Deferred query emission requires a lazy iterator');
      }
      const base = `(${from})${filtered ? `.filter(${row} => ${predicate})` : ''}`;
      return `${base}.map(${row} => ${selected})`;
    }
    case 'csharp': {
      emitter.uses.add('System.Linq');
      const body = `from ${row} in ${from}${filtered ? ` where ${predicate}` : ''} select ${selected}`;
      return `(${body}).${eager ? 'ToArray' : 'AsEnumerable'}()`;
    }
    default:
      throw new Error(`${emitter.syntax.label} has no query emitter`);
  }
}

export const withQueryWriter = (Base) =>
  class QueryEmitter extends Base {
    program(program) {
      return super.program(
        this.id === 'csharp' ? csharpQueryNames(program) : program
      );
    }

    type(meta) {
      const collection = /^(array|sequence)<(.+)>$/u.exec(meta);
      if (collection && ['csharp', 'typescript'].includes(this.id)) {
        const element = this.type(collection[2]);
        return collection[1] === 'array'
          ? `${element}[]`
          : this.id === 'csharp'
            ? `System.Collections.Generic.IEnumerable<${element}>`
            : `Iterable<${element}>`;
      }
      if (meta === 'object' && ['csharp', 'typescript'].includes(this.id)) {
        return this.id === 'csharp' ? 'object' : 'unknown';
      }
      return super.type(meta);
    }

    declaration(statement) {
      if (this.id === 'csharp' && statement.value?.kind === 'Query') {
        return `var ${this.variable(statement.name)} = ${this.expression(statement.value)};`;
      }
      return super.declaration(statement);
    }

    expression(expression, parent = 0) {
      if (expression.kind === 'Query') {
        return writeQuery(this, expression);
      }
      if (expression.kind === 'Lambda') {
        if (!['javascript', 'typescript'].includes(this.id)) {
          throw new Error(`${this.syntax.label} has no lambda emitter`);
        }
        return `(${expression.parameters.map((p) => this.variable(p)).join(', ')}) => ${this.expression(expression.body)}`;
      }
      return super.expression(expression, parent);
    }
  };
