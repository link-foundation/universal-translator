// SQL selects relations. Imperative programs are deliberately rejected.
import { node } from '../../meta/tree.js';
import { query, rowMembers } from '../query-parser.js';

const identifier = (value) => `"${value.replaceAll('"', '""')}"`;
const table = (value) => value.split('.').map(identifier).join('.');

const parser = (Base) =>
  class SqlParser extends Base {
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
