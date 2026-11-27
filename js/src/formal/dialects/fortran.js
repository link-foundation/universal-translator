// Fortran (free form, Fortran 2018): a main program whose variables are
// declared before its statements, and procedures after `contains`.

import { renderLines } from '../../translation/emission-map.js';
import { add, block, node, number, text as textNode } from '../../meta/tree.js';
import { SyntaxError } from '../lexer.js';
import { commentNode, declaredVariables, keywordParser } from './shared.js';

// The meta type of a declaration's first word.
const typeWords = {
  integer: 'integer',
  real: 'real',
  logical: 'boolean',
  character: 'text',
};
const format = "'(*(g0))'";

// Output statements and the statement lists around them.
const output = (Base) =>
  class FortranOutput extends Base {
    // write (unit, format, advance='no') items: a write ends its line
    // unless it says advance='no'. A format given by the label of a format
    // statement prints its text.
    fortranWrite() {
      this.expect('(');
      let position = 0;
      let label;
      let advance = true;
      while (!this.accept(')')) {
        if (this.is('advance') && this.is('=', 1)) {
          this.position += 2;
          advance = this.next().value.toLowerCase() !== 'no';
        } else if (position === 1 && this.peek().type === 'number') {
          label = this.next().value;
        } else {
          this.skipControlItem();
        }
        if (this.accept(',')) {
          position += 1;
        }
      }
      if (label === undefined) {
        return this.output(advance ? 'print' : 'write', true);
      }
      const text = this.formats?.get(label);
      if (text === undefined) {
        throw new SyntaxError(
          `No format statement labelled ${label}`,
          this.peek().line
        );
      }
      if (this.peek().type !== 'newline' && this.peek().type !== 'end') {
        throw new SyntaxError(
          'Items written with a format statement',
          this.peek().line
        );
      }
      return node('Evaluate', {
        expression: node('Call', {
          callee: advance ? 'print' : 'write',
          arguments: [text],
        }),
      });
    }

    // One item of a control list, up to the next "," or ")" outside
    // parentheses.
    skipControlItem() {
      let depth = 0;
      while (depth > 0 || (!this.is(',') && !this.is(')'))) {
        const token = this.next();
        if (token.value === '(') {
          depth += 1;
        } else if (token.value === ')') {
          depth -= 1;
        }
      }
    }

    // A statement label (`100 format (...)`, `10 continue`) is read and
    // dropped; format statements were read with the program. A stop that
    // is the last statement of the main program ends it as its end does.
    statementsUntil(done) {
      const statements = [];
      this.skipLines();
      while (!done() && this.peek().type !== 'end') {
        if (this.peek().type === 'number') {
          this.next();
        }
        if (this.peek().type === 'comment') {
          statements.push(commentNode(this.next()));
        } else if (this.is('format')) {
          this.skipLine();
        } else if (this.is('stop') && this.isLastStatement()) {
          this.skipLine();
        } else {
          statements.push(this.statement());
        }
        this.skipLines(statements);
      }
      return statements;
    }

    // Whether only comments, labelled format statements and the end of the
    // main program follow this line.
    isLastStatement() {
      let offset = 1;
      const at = () => this.peek(offset);
      while (at().type !== 'end') {
        if (at().type === 'newline' || at().type === 'comment') {
          offset += 1;
        } else if (at().type === 'number' && this.is('format', offset + 1)) {
          while (!['newline', 'end'].includes(at().type)) {
            offset += 1;
          }
        } else {
          return (
            this.is('end', offset) &&
            !this.is('if', offset + 1) &&
            !this.is('do', offset + 1) &&
            this.result === undefined
          );
        }
      }
      return false;
    }

    // print '(*(g0))', a, b and write (...) a, b print their items one
    // after another.
    output(callee, afterControlList = false) {
      const values = [];
      if (afterControlList && this.peek().type !== 'newline') {
        values.push(this.expression());
      }
      while (this.accept(',')) {
        values.push(this.expression());
      }
      return node('Evaluate', {
        expression: node('Call', { callee, arguments: values }),
      });
    }
  };

// Statements: if, do while, counted do, print, write, call and assignments.
const statements = (Base) =>
  class FortranStatements extends output(Base) {
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
        return this.fortranWrite();
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
      // new_line('a') is the line end character.
      if (this.is('new_line') && this.is('(', 1)) {
        this.position += 2;
        this.skipControlItem();
        this.expect(')');
        return textNode('\n');
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
      this.formats = this.formatStatements();
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

    // The text of each labelled format statement, by label: its quoted
    // texts, with a line end for each "/" (fixed-form programs write
    // `100 format (' Hello World! ' /)`).
    formatStatements() {
      const formats = new Map();
      this.tokens.forEach((token, index) => {
        const before = this.tokens[index - 1];
        const word = this.tokens[index + 1];
        if (
          token.type !== 'number' ||
          (before && before.type !== 'newline') ||
          word?.type !== 'name' ||
          word.value.toLowerCase() !== 'format'
        ) {
          return;
        }
        let text = '';
        let at = index + 3;
        for (let depth = 1; ; at += 1) {
          const item = this.tokens[at];
          if (item.type === 'text') {
            text += item.value;
          } else if (item.value === '/' || item.value === '//') {
            text += '\n'.repeat(item.value.length);
          } else if (item.value === '(') {
            depth += 1;
          } else if (item.value === ')' && --depth === 0) {
            break;
          } else if (item.value !== ',') {
            throw new SyntaxError(
              `Edit descriptor "${item.value}" in a format statement`,
              item.line
            );
          }
        }
        formats.set(token.value, textNode(text));
      });
      return formats;
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
  real: 'real(8)',
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

    // A line end inside text is new_line('a'): `'a' // new_line('a')`.
    quote(value) {
      const pieces = [];
      value.split('\n').forEach((line, index) => {
        if (index > 0) {
          pieces.push("new_line('a')");
        }
        if (line || value === '') {
          pieces.push(`'${line.replace(/'/g, "''")}'`);
        }
      });
      return pieces.join(' // ');
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
      return value.kind === 'Number' &&
        value.type !== 'real' &&
        Number.isInteger(value.value)
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
      this.comments(item, 'comments');
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
      this.comments(program, 'comments');
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
      this.comments(program, 'mainComments');
      this.body(program.main);
      if (program.functions.length) {
        this.depth -= 1;
        this.line();
        this.line('contains');
        this.depth += 1;
        program.functions.forEach((item, index) => {
          if (index === 0 || this.spacedAfter(program.functions, index - 1)) {
            this.line();
          }
          this.functionDefinition(item);
        });
      }
      this.depth -= 1;
      this.line('end program main');
      return renderLines(this, this.lines);
    }
  };

export const fortran = { parser, emitter };
