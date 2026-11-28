// SQL operations retain NULL propagation independently of host operators.
import { node, rewrite, walk } from '../meta/tree.js';
import { inheritOrigin } from '../translation/source-origins.js';
import { realText } from './numbers.js';
import { mergePureQueries } from './query-parser.js';
import { libraryEnd, topLevel } from './objpak-reader.js';
import runtimes from '../../../data/runtime/sql-values.json' with { type: 'json' };
import betweenMethods from '../../../data/runtime/sql-between.json' with { type: 'json' };
import { sqlBinaryOperators, sqlUnaryOperators } from '../meta/sql-values.js';

function extendedRuntime(id) {
  const base = runtimes[id];
  const headerEnd = base.indexOf('\n') + 1;
  return base.slice(0, headerEnd) + betweenMethods[id] + base.slice(headerEnd);
}

export function sqlValueSource(source, syntax) {
  const runtime = runtimes[syntax.id];
  const bindings = [];
  const betweenBindings = [];
  const definitions = [];
  let masked = source;
  if (runtime) {
    const declarations =
      syntax.id === 'csharp'
        ? /static class (UtSqlValue_*)\b/gu
        : /class (UtSqlValue_*)\b/gu;
    for (const match of source.matchAll(declarations)) {
      if (!topLevel(source, match.index, syntax)) {
        continue;
      }
      const extendedEnd = libraryEnd(
        source,
        match.index,
        extendedRuntime(syntax.id).replaceAll('$SQL$', match[1]),
        syntax
      );
      const end =
        extendedEnd ??
        libraryEnd(
          source,
          match.index,
          runtime.replaceAll('$SQL$', match[1]),
          syntax
        );
      if (end === undefined) {
        continue;
      }
      bindings.push(match[1]);
      if (extendedEnd !== undefined) {
        betweenBindings.push(match[1]);
      }
      definitions.push([match.index, end]);
      masked =
        masked.slice(0, match.index) +
        source
          .slice(match.index, end)
          .replace(/[^\r\n]/gu, (character) => ' '.repeat(character.length)) +
        masked.slice(end);
    }
  }
  return { source: masked, bindings, betweenBindings, definitions };
}

function methodNode(call, bindings, betweenBindings) {
  if (call.kind !== 'Call') {
    return call;
  }
  const dot = call.callee.lastIndexOf('.');
  const receiver = call.callee.slice(0, dot);
  if (!bindings.has(receiver)) {
    return call;
  }
  const method = call.callee.slice(dot + 1);
  const args = call.arguments;
  if (method === 'nullValue' && args.length === 0) {
    return node('Null');
  }
  if (method === 'isTrue' && args.length === 1) {
    return node('SqlTruth', { operand: args[0] });
  }
  if (
    method === 'between' &&
    betweenBindings.has(receiver) &&
    args.length === 3
  ) {
    const [value, lower, upper] = args;
    return node('SqlBetween', { value, lower, upper });
  }
  return sqlOperatorNode(method, args) ?? call;
}

function sqlOperatorNode(method, [label, ...operands]) {
  if (label?.kind !== 'Text') {
    return undefined;
  }
  const operator = label.value;
  if (
    method === 'binary' &&
    operands.length === 2 &&
    sqlBinaryOperators.has(operator)
  ) {
    const [left, right] = operands;
    return node('SqlBinary', { operator, left, right });
  }
  if (
    method === 'unary' &&
    operands.length === 1 &&
    sqlUnaryOperators.has(operator)
  ) {
    return node('SqlUnary', { operator, operand: operands[0] });
  }
  return undefined;
}

// A shadowed or reassigned class has no verified library contract.
export function recognizeSqlValues(program) {
  const { sqlValueBindings = [], sqlBetweenBindings = [], ...rest } = program;
  if (!sqlValueBindings.length) {
    return program;
  }
  const bindings = new Set(sqlValueBindings);
  const betweenBindings = new Set(sqlBetweenBindings);
  walk(rest, (current) => {
    if (
      ['Declaration', 'Assignment', 'Function', 'Parameter', 'Catch'].includes(
        current.kind
      )
    ) {
      bindings.delete(current.name?.split('.')[0]);
    }
    if (current.variable) {
      bindings.delete(current.variable);
    }
    if (current.kind === 'Function') {
      current.parameters.forEach((p) => bindings.delete(p.name));
    }
    if (current.kind === 'Lambda') {
      current.parameters.forEach((p) => bindings.delete(p));
    }
    if (current.kind === 'Name') {
      bindings.delete(current.name.split('.')[0]);
    }
  });
  if (bindings.size !== sqlValueBindings.length) {
    throw new Error(
      'SQL value library binding is shadowed, reassigned or used as a value'
    );
  }
  return mergePureQueries(
    rewrite(rest, (current) => {
      const result = methodNode(current, bindings, betweenBindings);
      if (
        current.kind === 'Call' &&
        bindings.has(current.callee.split('.')[0]) &&
        result === current
      ) {
        throw new Error('Unsupported SQL value library call');
      }
      return inheritOrigin(result, current);
    })
  );
}

export const withSqlValueWriter = (Base) =>
  class extends Base {
    program(program) {
      const used = new Set();
      walk(program, (current) => {
        if (current.name) {
          used.add(current.name);
        }
        if (current.variable) {
          used.add(current.variable);
        }
        if (current.kind === 'Call') {
          used.add(current.callee.split('.')[0]);
        }
        if (current.kind === 'Lambda') {
          current.parameters.forEach((p) => used.add(p));
        }
        if (current.kind === 'Function') {
          current.parameters.forEach((p) => used.add(p.name));
        }
      });
      this.sqlValueName = 'UtSqlValue';
      while (used.has(this.sqlValueName)) {
        this.sqlValueName += '_';
      }
      return super.program(program);
    }

    sqlOperand(expression) {
      return expression.kind === 'Number' &&
        expression.type === 'real' &&
        ['javascript', 'typescript'].includes(this.id)
        ? realText(expression.value)
        : this.expression(expression);
    }

    expression(expression, parent = 0) {
      if (
        !['Null', 'SqlBinary', 'SqlUnary', 'SqlTruth', 'SqlBetween'].includes(
          expression.kind
        ) ||
        this.id === 'sql'
      ) {
        return super.expression(expression, parent);
      }
      if (!runtimes[this.id]) {
        throw new Error(`${this.syntax.label} has no SQL value emitter`);
      }
      if (this.id === 'javascript' && !this.syntax.forEach) {
        throw new Error('SQL values require ECMAScript 2015 classes');
      }
      this.uses.add('sql-values');
      let method;
      let args;
      switch (expression.kind) {
        case 'Null':
          method = 'nullValue';
          args = [];
          break;
        case 'SqlTruth':
          method = 'isTrue';
          args = [this.sqlOperand(expression.operand)];
          break;
        case 'SqlBetween':
          method = 'between';
          args = [expression.value, expression.lower, expression.upper].map(
            (operand) => this.sqlOperand(operand)
          );
          break;
        case 'SqlUnary':
          if (!sqlUnaryOperators.has(expression.operator)) {
            throw new Error(
              `Unknown SQL unary operation: ${expression.operator}`
            );
          }
          method = 'unary';
          args = [
            this.quote(expression.operator),
            this.sqlOperand(expression.operand),
          ];
          break;
        default:
          if (!sqlBinaryOperators.has(expression.operator)) {
            throw new Error(
              `Unknown SQL binary operation: ${expression.operator}`
            );
          }
          method = 'binary';
          args = [
            this.quote(expression.operator),
            this.sqlOperand(expression.left),
            this.sqlOperand(expression.right),
          ];
      }
      return `${this.sqlValueName}.${method}(${args.join(', ')})`;
    }

    prelude(program) {
      const lines = super.prelude(program);
      if (this.uses.has('sql-values')) {
        lines.push(
          ...extendedRuntime(this.id)
            .replaceAll('$SQL$', this.sqlValueName)
            .trimEnd()
            .split('\n'),
          ''
        );
      }
      return lines;
    }
  };
