// SQL selects relations. Imperative programs are deliberately rejected.
import { node } from '../../meta/tree.js';
import { query, rowMembers } from '../query-parser.js';

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

function sqlExpression(parser, minimum = 0) {
  let left;
  if (parser.accept('not')) {
    left = node('Unary', {
      operator: 'not',
      operand: sqlExpression(parser, 3),
    });
  } else if (parser.accept('-')) {
    const operand = sqlExpression(parser, 8);
    left =
      operand.kind === 'Number'
        ? { ...operand, value: -operand.value }
        : node('Unary', { operator: 'negate', operand });
  } else {
    left = parser.postfix();
  }
  while (true) {
    const operator = Object.entries(operators).find(([spelling]) =>
      parser.is(spelling)
    )?.[1];
    if (!operator || operator[1] < minimum) {
      return left;
    }
    parser.next();
    left = node('Binary', {
      operator: operator[0],
      left,
      right: sqlExpression(parser, operator[1] + 1),
    });
  }
}

const identifier = (value) => `"${value.replaceAll('"', '""')}"`;
const table = (value) => value.split('.').map(identifier).join('.');

const parser = (Base) =>
  class SqlParser extends Base {
    expression() {
      return sqlExpression(this);
    }

    primary() {
      if (this.peek().quote === '"') {
        return node('Name', { name: this.next().value });
      }
      if (this.is('null')) {
        throw new Error('SQL NULL expressions require three-valued logic');
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
      this.expect('select');
      const projection = this.accept('*') ? undefined : this.expression();
      this.expect('from');
      const source = super.postfix();
      const variable = this.accept('as') ? this.expectName() : 'row';
      const condition = this.accept('where') ? this.expression() : undefined;
      return query(
        source,
        variable,
        projection
          ? rowMembers(projection, variable, true)
          : node('Name', { name: variable }),
        condition && rowMembers(condition, variable, true)
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
      if (expression.kind === 'Query') {
        const { source, variable, projection, condition } = expression;
        if (!expression.eager) {
          throw new Error(
            'SQL selection execution cannot preserve a deferred iterator'
          );
        }
        const relation =
          source.kind === 'Name'
            ? table(source.name)
            : `(${this.expression(source)})`;
        const selected =
          projection.kind === 'Name' && projection.name === variable
            ? '*'
            : this.expression(projection);
        const filtered =
          condition.kind === 'Boolean' && condition.value
            ? ''
            : ` WHERE ${this.expression(condition)}`;
        return `SELECT ${selected} FROM ${relation} AS ${identifier(variable)}${filtered}`;
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
