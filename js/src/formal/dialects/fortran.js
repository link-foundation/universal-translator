// Fortran (free form, Fortran 2018): a main program whose variables are
// declared before its statements, and procedures after `contains`.

import { add, block, node, number } from '../../meta/tree.js';
import { declaredVariables, keywordParser } from './shared.js';

// The meta type of a declaration's first word.
const typeWords = { integer: 'integer', logical: 'boolean', character: 'text' };
const format = "'(*(g0))'";

// Statements: if, do while, counted do, print, write, call and assignments.
const statements = (Base) =>
  class FortranStatements extends Base {
    statement() {
      if (this.accept('if')) {
        return this.fortranIf();
      }
      if (this.accept('do')) {
        return this.fortranDo();
      }
      if (this.accept('print')) {
        this.next();
        return this.output('print');
      }
      if (this.accept('write')) {
        this.expect('(');
        while (!this.accept(')')) {
          this.next();
        }
        return this.output('write');
      }
      if (this.accept('call')) {
        return node('Evaluate', { expression: this.called(this.expression()) });
      }
      if (this.accept('return')) {
        return node('Return', {});
      }
      const store = this.isElementAssignment();
      if (store) {
        return this.elementAssignment(store);
      }
      const name = this.expectName();
      this.expect('=');
      const value = this.expression();
      // A function returns by setting its result variable and leaving.
      if (name.toLowerCase() === this.result?.toLowerCase()) {
        this.skipLines();
        this.accept('return');
        return node('Return', { value });
      }
      return node('Assignment', { name, operator: '=', value });
    }

    // print '(*(g0))', a, b and write (...) a, b print their items one
    // after another.
    output(callee) {
      const values = [];
      if (callee === 'write' && this.peek().type !== 'newline') {
        values.push(this.expression());
      }
      while (this.accept(',')) {
        values.push(this.expression());
      }
      return node('Evaluate', {
        expression: node('Call', { callee, arguments: values }),
      });
    }

    // do while (condition) or do i = first, last: the meta loop stops
    // before its end.
    fortranDo() {
      if (this.accept('while')) {
        const condition = this.expression();
        return node('While', { condition, body: this.until('do') });
      }
      const variable = this.expectName();
      this.expect('=');
      const start = this.expression();
      this.expect(',');
      const last = this.expression();
      const body = this.until('do');
      return node('CountingLoop', {
        variable,
        start,
        end: add(last, number(1)),
        body,
      });
    }

    // The statements of a block up to `end do` or `end if`.
    until(word) {
      const statements = this.statementsUntil(() => this.is('end'));
      this.expect('end');
      this.expect(word);
      return block(statements);
    }

    // if (...) then ... else if (...) then ... else ... end if: the chain
    // shares a single `end if`.
    fortranIf() {
      const condition = this.expression();
      this.expect('then');
      const then = block(
        this.statementsUntil(() => this.is('else') || this.is('end'))
      );
      if (!this.accept('else')) {
        this.expect('end');
        this.expect('if');
        return node('If', { condition, then });
      }
      if (this.accept('if')) {
        return node('If', { condition, then, otherwise: this.fortranIf() });
      }
      return node('If', { condition, then, otherwise: this.until('if') });
    }

    // mod(a, b) is the remainder, and logical constants are dotted words.
    primary() {
      const token = this.peek();
      if (token.type === 'symbol' && /^\.(true|false)\.$/i.test(token.value)) {
        this.next();
        return node('Boolean', {
          value: token.value.toLowerCase() === '.true.',
        });
      }
      if (this.is('mod') && this.is('(', 1)) {
        this.position += 2;
        const left = this.expression();
        this.expect(',');
        const right = this.expression();
        this.expect(')');
        return node('Binary', { operator: 'remainder', left, right });
      }
      return super.primary();
    }
  };

const parser = (Base) =>
  class FortranParser extends statements(keywordParser(Base)) {
    program() {
      const items = [];
      this.gatherComments(items);
      this.expect('program');
      this.skipLine();
      this.specification(items);
      items.push(
        ...this.statementsUntil(() => this.is('contains') || this.is('end'))
      );
      if (this.accept('contains')) {
        this.gatherComments(items);
        while (!this.is('end')) {
          items.push(this.procedure());
          this.gatherComments(items);
        }
      }
      this.expect('end');
      this.skipLine();
      this.skipLines();
      return node('SourceProgram', { language: this.syntax.id, items });
    }

    // use, implicit none and declarations, which the first assignments
    // declare again; the types of dummy arguments are returned.
    specification(items) {
      const types = {};
      while (true) {
        this.skipLines();
        if (this.accept('use')) {
          items.push(node('Import', { text: `use ${this.expectName()}` }));
        } else if (this.is('implicit')) {
          this.skipLine();
        } else if (this.lineHas('::')) {
          const type = typeWords[this.next().value.toLowerCase()];
          while (!this.accept('::')) {
            this.next();
          }
          do {
            types[this.expectName().toLowerCase()] = type;
          } while (this.accept(','));
        } else {
          return types;
        }
      }
    }

    lineHas(symbol) {
      for (let offset = 0; this.peek(offset).type !== 'newline'; offset += 1) {
        if (this.peek(offset).type === 'end') {
          return false;
        }
        if (this.is(symbol, offset)) {
          return true;
        }
      }
      return false;
    }

    // recursive integer(8) function name(a, b) result(name_result) or
    // recursive subroutine name(a, b), up to end function or end subroutine.
    procedure() {
      let returnType = 'nothing';
      while (!this.is('function') && !this.is('subroutine')) {
        const word = this.next().value.toLowerCase();
        returnType = typeWords[word] ?? returnType;
      }
      const kind = this.next().value.toLowerCase();
      const name = this.expectName();
      const names = [];
      if (this.accept('(')) {
        while (!this.accept(')')) {
          names.push(this.expectName());
          this.accept(',');
        }
      }
      this.result = name;
      if (this.accept('result')) {
        this.expect('(');
        this.result = this.expectName();
        this.expect(')');
      }
      const types = this.specification([]);
      const body = this.statementsUntil(() => this.is('end'));
      this.expect('end');
      this.expect(kind);
      this.skipLine();
      this.result = undefined;
      return node('Function', {
        name,
        parameters: names.map((parameter) => ({
          name: parameter,
          type: types[parameter.toLowerCase()] ?? 'integer',
        })),
        returnType: types[name.toLowerCase()] ?? returnType,
        body: block(body),
      });
    }
  };

// Declared types: deferred-length text is allocated by its assignment.
const declaredTypes = {
  integer: 'integer(8)',
  boolean: 'logical',
  text: 'character(len=:), allocatable',
  // An array is allocated by its first assignment.
  array: 'integer(8), allocatable, dimension(:)',
};

// Statements: if, do, print, call and the result variable of functions.
const statementEmitter = (Base) =>
  class FortranStatementEmitter extends Base {
    print({ value, newline }) {
      const parts = value.kind === 'Interpolation' ? value.parts : [value];
      const items = parts.map((part) => this.expression(part)).join(', ');
      return newline
        ? `print ${format}, ${items}`
        : `write (*, ${format}, advance='no') ${items}`;
    }

    statement(statement) {
      if (statement.kind === 'Evaluate') {
        return this.line(`call ${this.expression(statement.expression)}`);
      }
      return super.statement(statement);
    }

    returnStatement({ value }) {
      if (value) {
        this.line(`${this.result} = ${this.expression(value)}`);
      }
      return 'return';
    }

    declaration({ name, value }) {
      return `${name} = ${this.expression(value ?? number(0))}`;
    }

    ifStatement(statement) {
      this.line(`if (${this.expression(statement.condition)}) then`);
      let current = statement;
      this.indented(current.then);
      while (current.otherwise?.kind === 'If') {
        current = current.otherwise;
        this.line(`else if (${this.expression(current.condition)}) then`);
        this.indented(current.then);
      }
      if (current.otherwise) {
        this.line('else');
        this.indented(current.otherwise);
      }
      this.line('end if');
    }

    indented(body) {
      this.depth += 1;
      this.body(body);
      this.depth -= 1;
    }

    whileStatement({ condition, body }) {
      this.line(`do while (${this.expression(condition)})`);
      this.indented(body);
      this.line('end do');
    }

    countingLoop({ variable, start, end, body }) {
      const last = this.expression(add(end, number(-1)));
      this.line(`do ${variable} = ${this.expression(start)}, ${last}`);
      this.indented(body);
      this.line('end do');
    }
  };

const emitter = (Base) =>
  class FortranEmitter extends statementEmitter(Base) {
    terminator() {
      return '';
    }

    quote(value) {
      return `'${value.replace(/'/g, "''")}'`;
    }

    unary(expression, parent) {
      if (expression.operator !== 'not') {
        return super.unary(expression, parent);
      }
      const result = `.not. ${this.expression(expression.operand, 7)}`;
      return parent > 7 ? `(${result})` : result;
    }

    binary(expression, parent) {
      if (expression.operator !== 'remainder') {
        return super.binary(expression, parent);
      }
      const { left, right } = expression;
      return `mod(${this.argument(left)}, ${this.argument(right)})`;
    }

    // Literal arguments are written with the kind of the integer(8)
    // arguments they are passed to.
    argument(value) {
      return value.kind === 'Number' && Number.isInteger(value.value)
        ? `${value.value}_8`
        : this.expression(value);
    }

    expression(expression, parent = 0) {
      if (expression.kind !== 'Call') {
        return super.expression(expression, parent);
      }
      const values = expression.arguments.map((value) => this.argument(value));
      return `${expression.callee}(${values.join(', ')})`;
    }

    // integer(8) :: name, one declaration per variable.
    variables(body, known = []) {
      const variables = declaredVariables(body);
      const lines = [...variables]
        .filter(([variable]) => !known.includes(variable))
        .map(([variable, type]) => `${declaredTypes[type]} :: ${variable}`);
      lines.forEach((line) => this.line(line));
      return lines.length;
    }

    functionDefinition(item) {
      for (const text of item.comments ?? []) {
        this.comment(text);
      }
      const list = item.parameters.map(({ name }) => name).join(', ');
      const subroutine = item.returnType === 'nothing';
      const kind = subroutine ? 'subroutine' : 'function';
      // Deferred-length text cannot be named before `function`.
      const prefix =
        subroutine || item.returnType === 'text'
          ? ''
          : `${declaredTypes[item.returnType]} `;
      this.result = `${item.name}_result`;
      const result = subroutine ? '' : ` result(${this.result})`;
      this.line(`recursive ${prefix}${kind} ${item.name}(${list})${result}`);
      this.depth += 1;
      for (const { name, type } of item.parameters) {
        this.line(
          type === 'text'
            ? `character(len=*), intent(in) :: ${name}`
            : `${declaredTypes[type]}, value :: ${name}`
        );
      }
      if (item.returnType === 'text') {
        this.line(`${declaredTypes.text} :: ${this.result}`);
      }
      const names = item.parameters.map(({ name }) => name);
      if (item.parameters.length + this.variables(item.body, names)) {
        this.line();
      }
      this.body(item.body);
      this.depth -= 1;
      this.line(`end ${kind} ${item.name}`);
    }

    program(program) {
      for (const text of program.comments) {
        this.comment(text);
      }
      if (program.comments.length) {
        this.line();
      }
      this.line('program main');
      this.depth += 1;
      for (const text of program.libraryImports ?? []) {
        this.line(text);
      }
      this.line('implicit none');
      this.variables(program.main);
      this.line();
      for (const text of program.mainComments ?? []) {
        this.comment(text);
      }
      this.body(program.main);
      if (program.functions.length) {
        this.depth -= 1;
        this.line();
        this.line('contains');
        this.depth += 1;
        for (const item of program.functions) {
          this.line();
          this.functionDefinition(item);
        }
      }
      this.depth -= 1;
      this.line('end program main');
      return `${this.lines.join('\n')}\n`;
    }
  };

export const fortran = { parser, emitter };
