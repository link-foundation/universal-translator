// Visual Basic .NET: a module whose functions and subs end with End
// Function and End Sub, and whose Sub Main is the entry point.

import { add, block, node, number } from '../meta.js';
import { defaultValues, keywordParser } from './shared.js';

// Words before a procedure that do not change what it means.
const modifiers = ['private', 'public', 'shared', 'friend'];
// The operators Visual Basic binds at different levels: * and / above \,
// and \ above Mod.
const multiplicative = ['multiply', 'divide', 'remainder'];

// Statements: Dim, If, While, For, Return, assignments and calls.
const statements = (Base) =>
  class VisualBasicStatements extends Base {
    statement() {
      if (this.accept('dim')) {
        return this.dim();
      }
      if (this.accept('if')) {
        return this.vbIf();
      }
      if (this.accept('while')) {
        const condition = this.expression();
        return node('While', { condition, body: this.until('while') });
      }
      if (this.accept('for')) {
        return this.vbFor();
      }
      if (this.accept('return')) {
        const value =
          this.peek().type === 'newline' || this.peek().type === 'end'
            ? undefined
            : this.expression();
        return node('Return', { value });
      }
      if (this.peek().type === 'name') {
        const assignment = this.assignment();
        if (assignment) {
          return assignment;
        }
      }
      return node('Evaluate', { expression: this.called(this.expression()) });
    }

    // name = value, name += value, and name \= value for integer division.
    assignment() {
      if (this.is('\\', 1) && this.is('=', 2)) {
        const name = this.next().value;
        this.position += 2;
        return node('Assignment', {
          name,
          operator: '=',
          value: node('Binary', {
            operator: 'divide',
            left: node('Name', { name }),
            right: this.expression(),
          }),
        });
      }
      const operator = ['=', '+=', '-=', '*='].find((symbol) =>
        this.is(symbol, 1)
      );
      if (!operator) {
        return undefined;
      }
      const name = this.next().value;
      this.next();
      return node('Assignment', { name, operator, value: this.expression() });
    }

    // Dim name As Type = value: the type is kept when the value is missing.
    dim() {
      const name = this.expectName();
      let type;
      if (this.accept('as')) {
        type = this.typeOf(this.expectName());
      }
      const value = this.accept('=')
        ? this.expression()
        : defaultValues[type ?? 'integer'];
      return node('Declaration', { name, value, mutable: true });
    }

    // For I As Long = First To Last ... Next: the meta loop stops before
    // its end.
    vbFor() {
      const variable = this.expectName();
      if (this.accept('as')) {
        this.expectName();
      }
      this.expect('=');
      const start = this.expression();
      this.expect('to');
      const last = this.expression();
      const body = block(this.statementsUntil(() => this.is('next')));
      this.expect('next');
      if (this.peek().type === 'name') {
        this.next();
      }
      return node('CountingLoop', {
        variable,
        start,
        end: add(last, number(1)),
        body,
      });
    }

    // The statements of a block up to End While, End If, End Sub, ...
    until(word) {
      const statements = this.statementsUntil(() => this.is('end'));
      this.expect('end');
      this.expect(word);
      return block(statements);
    }

    // If ... Then ... ElseIf ... Then ... Else ... End If
    vbIf() {
      const condition = this.expression();
      this.expect('then');
      const then = block(
        this.statementsUntil(
          () => this.is('elseif') || this.is('else') || this.is('end')
        )
      );
      if (this.accept('elseif')) {
        return node('If', { condition, then, otherwise: this.vbIf() });
      }
      if (this.accept('else')) {
        return node('If', { condition, then, otherwise: this.until('if') });
      }
      this.expect('end');
      this.expect('if');
      return node('If', { condition, then });
    }
  };

const parser = (Base) =>
  class VisualBasicParser extends statements(keywordParser(Base)) {
    // Imports, then a module of procedures; Sub Main is the entry point.
    program() {
      const items = [];
      this.gatherComments(items);
      while (this.is('imports') || this.is('option')) {
        this.skipLine();
        this.gatherComments(items);
      }
      this.expect('module');
      this.skipLine();
      this.gatherComments(items);
      while (!this.is('end')) {
        items.push(this.procedure());
        this.gatherComments(items);
      }
      this.expect('end');
      this.expect('module');
      this.gatherComments(items);
      return node('SourceProgram', { language: this.syntax.id, items });
    }

    // Function Name(a As Long, b As Long) As Long ... End Function, or
    // Sub Name(...) ... End Sub.
    procedure() {
      while (modifiers.some((word) => this.is(word))) {
        this.next();
      }
      const kind = this.next().value.toLowerCase();
      const name = this.expectName();
      const parameters = [];
      this.expect('(');
      while (!this.accept(')')) {
        this.accept('byval');
        const parameter = this.expectName();
        this.expect('as');
        parameters.push({
          name: parameter,
          type: this.typeOf(this.expectName()),
        });
        this.accept(',');
      }
      const returnType =
        kind === 'function' && this.accept('as')
          ? this.typeOf(this.expectName())
          : 'nothing';
      return node('Function', {
        name,
        parameters,
        returnType,
        body: this.until(kind),
      });
    }
  };

// Statements: Dim, If, While, For and output.
const statementEmitter = (Base) =>
  class VisualBasicStatementEmitter extends Base {
    terminator() {
      return '';
    }

    print({ value, newline }) {
      const procedure = newline ? 'Console.WriteLine' : 'Console.Write';
      const empty = value.kind === 'Text' && value.value === '' && newline;
      return `${procedure}(${empty ? '' : this.expression(value)})`;
    }

    returnStatement({ value }) {
      return value ? `Return ${this.expression(value)}` : 'Return';
    }

    declaration({ name, type, value }) {
      const initial = this.expression(
        value ?? defaultValues[type ?? 'integer']
      );
      return `Dim ${name} As ${this.type(type ?? 'integer')} = ${initial}`;
    }

    indented(body) {
      this.depth += 1;
      this.body(body);
      this.depth -= 1;
    }

    ifStatement(statement) {
      this.line(`If ${this.expression(statement.condition)} Then`);
      let current = statement;
      this.indented(current.then);
      while (current.otherwise?.kind === 'If') {
        current = current.otherwise;
        this.line(`ElseIf ${this.expression(current.condition)} Then`);
        this.indented(current.then);
      }
      if (current.otherwise) {
        this.line('Else');
        this.indented(current.otherwise);
      }
      this.line('End If');
    }

    whileStatement({ condition, body }) {
      this.line(`While ${this.expression(condition)}`);
      this.indented(body);
      this.line('End While');
    }

    countingLoop({ variable, start, end, body }) {
      const last = this.expression(add(end, number(-1)));
      const type = this.type('integer');
      this.line(
        `For ${variable} As ${type} = ${this.expression(start)} To ${last}`
      );
      this.indented(body);
      this.line('Next');
    }
  };

const emitter = (Base) =>
  class VisualBasicEmitter extends statementEmitter(Base) {
    // Text has no escapes: a quote is doubled and a line end is joined in.
    quote(value) {
      return value
        .split('\n')
        .map((line) => `"${line.replace(/"/g, '""')}"`)
        .join(' & vbLf & ');
    }

    interpolation(parts) {
      const pieces = parts.map((part) =>
        part.kind === 'Text'
          ? part.value
              .replace(/"/g, '""')
              .replace(/\{/g, '{{')
              .replace(/\}/g, '}}')
          : `{${this.expression(part)}}`
      );
      return `$"${pieces.join('')}"`;
    }

    // A multiplicative operand with another operator keeps its parentheses.
    binary(expression, parent) {
      if (!multiplicative.includes(expression.operator)) {
        return super.binary(expression, parent);
      }
      const grouped = (side) =>
        side.kind === 'Binary' &&
        multiplicative.includes(side.operator) &&
        side.operator !== expression.operator
          ? { kind: 'Grouped', expression: side }
          : side;
      return super.binary(
        {
          ...expression,
          left: grouped(expression.left),
          right: grouped(expression.right),
        },
        parent
      );
    }

    expression(expression, parent = 0) {
      if (expression.kind === 'Grouped') {
        return `(${this.expression(expression.expression)})`;
      }
      return super.expression(expression, parent);
    }

    functionDefinition(item) {
      for (const text of item.comments ?? []) {
        this.comment(text);
      }
      const parameters = item.parameters
        .map(({ name, type }) => `${name} As ${this.type(type)}`)
        .join(', ');
      const kind = item.returnType === 'nothing' ? 'Sub' : 'Function';
      const returns = kind === 'Sub' ? '' : ` As ${this.type(item.returnType)}`;
      this.line(`${kind} ${item.name}(${parameters})${returns}`);
      this.indented(item.body);
      this.line(`End ${kind}`);
    }

    program(program) {
      for (const text of program.comments) {
        this.comment(text);
      }
      if (program.comments.length) {
        this.line();
      }
      this.line('Module Program');
      this.depth = 1;
      for (const item of program.functions) {
        this.functionDefinition(item);
        this.line();
      }
      for (const text of program.mainComments ?? []) {
        this.comment(text);
      }
      this.line('Sub Main()');
      this.indented(program.main);
      this.line('End Sub');
      this.depth = 0;
      this.line('End Module');
      return `${this.lines.join('\n')}\n`;
    }
  };

export const vb = { parser, emitter };
