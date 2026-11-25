// Pascal (Free Pascal): a program heading, procedures and functions with
// their own var sections, and a main block between begin and end.

import { add, block, node, number } from '../../meta/tree.js';
import { declaredVariables, keywordParser } from './shared.js';

// Pascal binds "and" like "*" and "or" like "+", above the comparisons, so
// a comparison inside a logical operation keeps its parentheses.
const levels = {
  equal: 1,
  notEqual: 1,
  less: 1,
  lessOrEqual: 1,
  greater: 1,
  greaterOrEqual: 1,
  or: 2,
  add: 2,
  subtract: 2,
  and: 3,
  multiply: 3,
  divide: 3,
  remainder: 3,
};
const spellings = {
  equal: '=',
  notEqual: '<>',
  less: '<',
  lessOrEqual: '<=',
  greater: '>',
  greaterOrEqual: '>=',
  or: 'or',
  add: '+',
  subtract: '-',
  and: 'and',
  multiply: '*',
  divide: 'div',
  remainder: 'mod',
};

// Statements: if, while, for, Exit, assignments and procedure calls.
const statements = (Base) =>
  class PascalStatements extends Base {
    statement() {
      if (this.accept('if')) {
        return this.pascalIf();
      }
      if (this.accept('while')) {
        const condition = this.expression();
        this.expect('do');
        return node('While', { condition, body: this.branch() });
      }
      if (this.accept('for')) {
        return this.pascalFor();
      }
      if (this.accept('exit')) {
        let value;
        if (this.accept('(')) {
          value = this.is(')') ? undefined : this.expression();
          this.expect(')');
        }
        return node('Return', { value });
      }
      const store = this.isElementAssignment();
      if (store) {
        return this.elementAssignment(store);
      }
      if (this.peek().type === 'name' && this.is(':=', 1)) {
        const name = this.next().value;
        this.next();
        return node('Assignment', {
          name,
          operator: '=',
          value: this.expression(),
        });
      }
      return node('Evaluate', { expression: this.called(this.expression()) });
    }

    // for I := First to Last do: the meta loop stops before its end.
    pascalFor() {
      const variable = this.expectName();
      this.expect(':=');
      const start = this.expression();
      this.expect('to');
      const last = this.expression();
      this.expect('do');
      const body = this.branch();
      return node('CountingLoop', {
        variable,
        start,
        end: add(last, number(1)),
        body,
      });
    }

    pascalIf() {
      const condition = this.expression();
      this.expect('then');
      const then = this.branch();
      let offset = 0;
      while (this.peek(offset).type === 'newline') {
        offset += 1;
      }
      if (!this.is('else', offset)) {
        return node('If', { condition, then });
      }
      this.position += offset + 1;
      const otherwise = this.accept('if') ? this.pascalIf() : this.branch();
      return node('If', { condition, then, otherwise });
    }

    // A compound statement between begin and end, or a single statement.
    branch() {
      this.skipLines();
      if (!this.accept('begin')) {
        return block([this.statement()]);
      }
      const statements = this.statementsUntil(() => this.is('end'));
      this.expect('end');
      return block(statements);
    }
  };

const parser = (Base) =>
  class PascalParser extends statements(keywordParser(Base)) {
    program() {
      const items = [];
      this.gatherComments(items);
      this.expect('program');
      this.skipLine();
      this.skipLines();
      while (this.peek().type !== 'end') {
        this.gatherComments(items);
        this.skipLines();
        if (this.is('uses')) {
          this.next();
          items.push(node('Import', { text: `uses ${this.expectName()}` }));
        } else if (this.is('function') || this.is('procedure')) {
          const routine = this.routine();
          if (routine) {
            items.push(routine);
          }
        } else if (this.is('var')) {
          this.skipVariables();
        } else if (this.accept('begin')) {
          items.push(...this.statementsUntil(() => this.is('end')));
          this.expect('end');
          this.expect('.');
          break;
        } else if (this.peek().type !== 'end') {
          this.statement();
        }
      }
      return node('SourceProgram', { language: this.syntax.id, items });
    }

    // Variables are declared again by their first assignment.
    skipVariables() {
      this.next();
      while (
        !['begin', 'function', 'procedure', 'var'].some((word) =>
          this.is(word)
        ) &&
        this.peek().type !== 'end'
      ) {
        this.next();
      }
    }

    // function Name(A, B: Int64; C: String): Int64; ... begin ... end;
    // A heading followed by `forward;` only announces a later definition.
    routine() {
      const isFunction = this.next().value.toLowerCase() === 'function';
      const name = this.expectName();
      const parameters = [];
      if (this.accept('(')) {
        while (!this.is(')')) {
          const names = [this.expectName()];
          while (this.accept(',')) {
            names.push(this.expectName());
          }
          this.expect(':');
          const type = this.typeOf(this.expectName());
          names.forEach((parameter) =>
            parameters.push({ name: parameter, type })
          );
          if (!this.accept(';')) {
            break;
          }
        }
        this.expect(')');
      }
      const returnType = isFunction
        ? (this.expect(':'), this.typeOf(this.expectName()))
        : 'nothing';
      this.expect(';');
      this.skipLines();
      if (this.accept('forward')) {
        return undefined;
      }
      while (this.is('var')) {
        this.skipVariables();
      }
      this.expect('begin');
      const body = this.statementsUntil(() => this.is('end'));
      this.expect('end');
      this.accept(';');
      return node('Function', {
        name,
        parameters,
        returnType,
        body: block(body),
      });
    }
  };

const emitter = (Base) =>
  class PascalEmitter extends Base {
    terminator() {
      return ';';
    }

    quote(value) {
      return `'${value.replace(/'/g, "''")}'`;
    }

    // Operands of "or" are parenthesized like in the other languages, so
    // `(A and B) or C` reads the same everywhere.
    binary({ operator, left, right }, parent) {
      const level = levels[operator];
      const inner = operator === 'or' ? levels.and + 1 : level;
      const result = `${this.expression(left, inner)} ${spellings[operator]} ${this.expression(right, Math.max(inner, level + 1))}`;
      return level < parent ? `(${result})` : result;
    }

    print({ value, newline }) {
      const parts = value.kind === 'Interpolation' ? value.parts : [value];
      const written = parts.map((part) => this.expression(part)).join(', ');
      return `${newline ? 'WriteLn' : 'Write'}(${written});`;
    }

    returnStatement({ value }) {
      return value ? `Exit(${this.expression(value)});` : 'Exit;';
    }

    declaration({ name, value }) {
      return `${name} := ${this.expression(value ?? number(0))};`;
    }

    // begin ... end, with the text that follows end (";", "." or nothing).
    compound(statements, after = ';') {
      this.line('begin');
      this.depth += 1;
      this.body(statements);
      this.depth -= 1;
      this.line(`end${after}`);
    }

    ifStatement(statement) {
      this.line(`if ${this.expression(statement.condition)} then`);
      let current = statement;
      while (current.otherwise?.kind === 'If') {
        this.compound(current.then, '');
        current = current.otherwise;
        this.line(`else if ${this.expression(current.condition)} then`);
      }
      if (current.otherwise) {
        this.compound(current.then, '');
        this.line('else');
        this.compound(current.otherwise);
      } else {
        this.compound(current.then);
      }
    }

    whileStatement({ condition, body }) {
      this.line(`while ${this.expression(condition)} do`);
      this.compound(body);
    }

    countingLoop({ variable, start, end, body }) {
      const last = this.expression(add(end, number(-1)));
      this.line(`for ${variable} := ${this.expression(start)} to ${last} do`);
      this.compound(body);
    }

    // var
    //     Name: Int64;
    variables(body) {
      const variables = declaredVariables(body);
      if (variables.size === 0) {
        return;
      }
      this.line('var');
      this.depth += 1;
      for (const [variable, type] of variables) {
        this.line(`${variable}: ${this.type(type)};`);
      }
      this.depth -= 1;
    }

    heading(item) {
      const parameters = item.parameters
        .map(({ name, type }) => `${name}: ${this.type(type)}`)
        .join('; ');
      const list = parameters ? `(${parameters})` : '';
      return item.returnType === 'nothing'
        ? `procedure ${item.name}${list};`
        : `function ${item.name}${list}: ${this.type(item.returnType)};`;
    }

    functionDefinition(item) {
      for (const text of item.comments ?? []) {
        this.comment(text);
      }
      this.line(this.heading(item));
      this.variables(item.body);
      this.compound(item.body);
    }

    forwardDeclaration(item) {
      return `${this.heading(item)} forward;`;
    }

    main(program) {
      this.variables(program.main);
      if (this.lines.at(-1) !== '' && this.lines.length) {
        this.line();
      }
      this.line('begin');
      this.depth += 1;
      for (const text of program.mainComments ?? []) {
        this.comment(text);
      }
      this.body(program.main);
      this.depth -= 1;
      this.line('end.');
    }
  };

export const pascal = { parser, emitter };
