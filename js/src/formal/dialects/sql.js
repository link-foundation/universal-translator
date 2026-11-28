// SQL selects relations. Imperative programs are deliberately rejected.
import { name, node, rewrite, text } from '../../meta/tree.js';
import { inheritOrigin } from '../../translation/source-origins.js';
import { asciiLowercase, SyntaxError } from '../lexer.js';
import { query } from '../query-parser.js';

// NOT binds below comparisons and above AND in SQL. A prefix can also
// occur on a binary operand, so its operand uses its own binding power.
const operators = {
  or: ['or', 1],
  and: ['and', 2],
  '=': ['equal', 4],
  '==': ['equal', 4],
  '<>': ['notEqual', 4],
  '!=': ['notEqual', 4],
  '<': ['less', 5],
  '<=': ['lessOrEqual', 5],
  '>': ['greater', 5],
  '>=': ['greaterOrEqual', 5],
  '+': ['add', 6],
  '-': ['subtract', 6],
  '*': ['multiply', 7],
  '/': ['divide', 7],
  '%': ['remainder', 7],
};

function realExpression(part) {
  return (
    part.type === 'real' ||
    part.operator === 'realDivide' ||
    (part.kind === 'SqlUnary' &&
      part.operator === 'negate' &&
      realExpression(part.operand)) ||
    (part.kind === 'SqlBinary' &&
      ['add', 'subtract', 'multiply', 'remainder'].includes(part.operator) &&
      (realExpression(part.left) || realExpression(part.right)))
  );
}

function sqlIs(left, operator, right) {
  return right.kind === 'Boolean'
    ? node('SqlUnary', {
        operator: `${operator}${right.value ? 'True' : 'False'}`,
        operand: left,
      })
    : node('SqlBinary', { operator, left, right });
}

function sqlBinary(operator, left, right) {
  return node('SqlBinary', {
    operator:
      operator === 'divide' && (realExpression(left) || realExpression(right))
        ? 'realDivide'
        : operator,
    left,
    right,
  });
}

function sqlExpression(parser, minimum = 0) {
  let left;
  if (parser.accept('not')) {
    left = node('SqlUnary', {
      operator: 'not',
      operand: sqlExpression(parser, 3),
    });
  } else if (parser.accept('-')) {
    const operand = sqlExpression(parser, 8);
    left =
      operand.kind === 'Number'
        ? { ...operand, value: -operand.value }
        : node('SqlUnary', { operator: 'negate', operand });
  } else {
    left = parser.postfix();
  }
  while (true) {
    if (minimum <= 4 && parser.accept('is')) {
      const operator = parser.accept('not') ? 'isNot' : 'is';
      const right = sqlExpression(parser, 5);
      left = sqlIs(left, operator, right);
      continue;
    }
    const operator = Object.entries(operators).find(([spelling]) =>
      parser.is(spelling)
    )?.[1];
    if (!operator || operator[1] < minimum) {
      return left;
    }
    parser.next();
    const right = sqlExpression(parser, operator[1] + 1);
    left = sqlBinary(operator[0], left, right);
  }
}

const identifier = (value) => `"${value.replaceAll('"', '""')}"`;
const table = (value) => value.split('.').map(identifier).join('.');

const identifierParts = (reference) => reference.parts ?? [reference.name];

function bindColumns(expression, variable, qualifiers, line) {
  return rewrite(expression, (current) => {
    if (current.kind !== 'Name') {
      return current;
    }
    const parts = identifierParts(current);
    const qualifier = parts.slice(0, -1).map(asciiLowercase);
    if (
      qualifier.length &&
      !qualifiers.some(
        (candidate) =>
          candidate.length === qualifier.length &&
          candidate.every((part, index) => part === qualifier[index])
      )
    ) {
      throw new SyntaxError(
        `Unknown SQL column qualifier ${parts.slice(0, -1).join('.')}`,
        line
      );
    }
    return node('Index', { array: name(variable), index: text(parts.at(-1)) });
  });
}

function writeSelection(emitter, expression) {
  const { source, variable, projection, condition } = expression;
  if (!expression.eager) {
    throw new Error(
      'SQL selection execution cannot preserve a deferred iterator'
    );
  }
  const from = emitter.expression(source);
  const relation = ['Name', 'SqlRelation'].includes(source.kind)
    ? from
    : `(${from})`;
  const selected =
    projection.kind === 'Name' && projection.name === variable
      ? '*'
      : emitter.expression(projection);
  const filtered =
    condition.kind === 'Boolean' && condition.value
      ? ''
      : ` WHERE ${emitter.expression(condition.kind === 'SqlTruth' ? condition.operand : condition)}`;
  return `SELECT ${selected} FROM ${relation} AS ${identifier(variable)}${filtered}`;
}

function sqlValueText(emitter, expression, binary) {
  if (expression.kind === 'Null') {
    return 'NULL';
  }
  if (expression.kind === 'SqlTruth') {
    return `(${emitter.expression(expression.operand)}) IS TRUE`;
  }
  if (expression.kind === 'SqlUnary') {
    const operand = emitter.expression(expression.operand);
    const truth = {
      isTrue: 'IS TRUE',
      isFalse: 'IS FALSE',
      isNotTrue: 'IS NOT TRUE',
      isNotFalse: 'IS NOT FALSE',
    }[expression.operator];
    if (truth) {
      return `(${operand} ${truth})`;
    }
    if (!['not', 'negate'].includes(expression.operator)) {
      throw new Error('Unknown SQL unary operation');
    }
    return `(${expression.operator === 'not' ? 'NOT ' : '-'}(${operand}))`;
  }
  if (expression.kind === 'SqlBinary') {
    if (['is', 'isNot'].includes(expression.operator)) {
      return `(${emitter.expression(expression.left)} IS${expression.operator === 'isNot' ? ' NOT' : ''} ${emitter.expression(expression.right)})`;
    }
    return `(${binary({ ...expression, kind: 'Binary', operator: expression.operator === 'realDivide' ? 'divide' : expression.operator })})`;
  }
  return undefined;
}

const parser = (Base) =>
  class SqlParser extends Base {
    expression() {
      return sqlExpression(this);
    }

    primary() {
      if (this.accept('null')) {
        return node('Null');
      }
      if (
        this.peek().type === 'name' &&
        !this.is('true') &&
        !this.is('false')
      ) {
        const parts = [this.expectName()];
        while (this.accept('.')) {
          parts.push(this.expectName());
        }
        return parts.length > 1 || parts[0].includes('.')
          ? node('Name', { name: parts.join('.'), parts })
          : name(parts[0]);
      }
      return super.primary();
    }

    item() {
      if (this.peek().type === 'comment') {
        return super.item();
      }
      const expression = this.selection();
      this.endStatement();
      return node('Evaluate', { expression });
    }

    selection() {
      const { line } = this.expect('select');
      const projection = this.accept('*') ? undefined : this.expression();
      this.expect('from');
      const relation = super.postfix();
      if (relation.kind !== 'Name') {
        throw new SyntaxError('Expected a named SQL relation', line);
      }
      const alias = this.accept('as') ? this.expectName() : undefined;
      const variable =
        alias && /^[A-Za-z_][A-Za-z0-9_]*$/u.test(alias) ? alias : 'row';
      const parts = identifierParts(relation);
      const folded = parts.map(asciiLowercase);
      const qualifiers =
        alias === undefined
          ? [folded, [folded.at(-1)]]
          : [[asciiLowercase(alias)]];
      const bind = (expression) =>
        bindColumns(expression, variable, qualifiers, line);
      const source = relation.parts
        ? inheritOrigin(node('SqlRelation', { parts }), relation)
        : relation;
      const condition = this.accept('where') ? this.expression() : undefined;
      return query(
        source,
        variable,
        projection ? bind(projection) : name(variable),
        condition && node('SqlTruth', { operand: bind(condition) })
      );
    }
  };

const emitter = (Base) =>
  class SqlEmitter extends Base {
    unary(expression, parent) {
      return expression.operator === 'not'
        ? `(NOT (${this.expression(expression.operand)}))`
        : super.unary(expression, parent);
    }

    quote(value) {
      return `'${value.replaceAll("'", "''")}'`;
    }

    expression(expression, parent = 0) {
      const value = sqlValueText(this, expression, (binary) =>
        super.binary(binary, 0)
      );
      if (value !== undefined) {
        return value;
      }
      if (expression.kind === 'SqlRelation') {
        return expression.parts.map(identifier).join('.');
      }
      if (expression.kind === 'Query') {
        return writeSelection(this, expression);
      }
      if (
        expression.kind === 'Index' &&
        expression.index.kind === 'Text' &&
        expression.array.kind === 'Name'
      ) {
        return `${identifier(expression.array.name)}.${identifier(expression.index.value)}`;
      }
      if (expression.kind === 'Name') {
        return table(expression.name);
      }
      return super.expression(expression, parent);
    }

    program(program) {
      if (
        program.functions.length ||
        program.main.statements.some(
          (item) =>
            !['Comment', 'Blank'].includes(item.kind) &&
            (item.kind !== 'Evaluate' || item.expression.kind !== 'Query')
        )
      ) {
        throw new Error('SQL requires selection queries');
      }
      this.comments(program);
      for (const item of program.main.statements) {
        this.statement(item);
      }
      return this.lines.join('\n') + (this.lines.length ? '\n' : '');
    }
  };

export const sql = { parser, emitter };
