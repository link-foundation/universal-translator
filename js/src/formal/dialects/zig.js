// Zig: functions write their result type after the parameters, output
// goes through a buffered writer that main opens on standard output, and a
// counting loop is a while loop with a continue expression. Integer
// division and remainder are the builtins @divTrunc and @rem, and a value
// the program does not use is discarded with `_ =`.

import { add, block, node, number, text, walk } from '../../meta/tree.js';
import { decodeEscapes, SyntaxError } from '../lexer.js';
import { sourceType } from '../parser.js';

// main opens the writer that every print uses; these lines are layout, not
// part of the program.
const writerSetup = [
  'var buffer: [4096]u8 = undefined;',
  'var writer = std.Io.File.stdout().writer(init.io, &buffer);',
  'out = &writer.interface;',
  'defer out.flush() catch {};',
];
const writerNames = new Set(['out', 'buffer', 'writer']);
const placeholders = { integer: '{d}', text: '{s}', boolean: '{}' };
const builtins = { divTrunc: 'divide', rem: 'remainder' };
// Arrays of n values live as long as the function, in pages of memory.
const allocator = 'std.heap.page_allocator';

// The parts of a print format: {d}, {s} and {} take the next value, and
// {{ and }} are braces.
function formatParts(format, values) {
  const parts = [];
  let literal = '';
  for (const piece of format.split(/(\{\{|\}\}|\{[a-z]*\})/)) {
    if (piece === '{{' || piece === '}}') {
      literal += piece[0];
    } else if (/^\{[a-z]*\}$/.test(piece)) {
      if (literal) {
        parts.push(text(literal));
      }
      literal = '';
      parts.push(values.shift());
    } else {
      literal += piece;
    }
  }
  if (literal) {
    parts.push(text(literal));
  }
  return parts;
}

// Whether a statement reads or writes the variable.
function mentions(statement, variable) {
  let found = false;
  walk(statement, (current) => {
    found ||=
      (current.kind === 'Name' && current.name === variable) ||
      (['Assignment', 'Declaration'].includes(current.kind) &&
        current.name === variable);
  });
  return found;
}

// Whether the statements read the variable before they set it again.
function readLater(statements, variable) {
  for (const statement of statements) {
    if (
      ['Assignment', 'Declaration'].includes(statement.kind) &&
      statement.name === variable &&
      statement.operator !== '+=' &&
      !mentions(statement.value ?? number(0), variable)
    ) {
      return false;
    }
    if (mentions(statement, variable)) {
      return true;
    }
  }
  return false;
}

// `var i: i64 = a;` followed by `while (i < b) : (i += 1)` counts when i
// is not read after the loop.
function isCounting(start, loop, rest) {
  const { condition, update } = loop;
  return (
    ['Declaration', 'Assignment'].includes(start?.kind) &&
    start.name === update.name &&
    (start.operator ?? '=') === '=' &&
    ['less', 'lessOrEqual'].includes(condition.operator) &&
    condition.left.kind === 'Name' &&
    condition.left.name === update.name &&
    update.operator === '+=' &&
    update.value.kind === 'Number' &&
    update.value.value === 1 &&
    !readLater(rest, update.name)
  );
}

// Every other loop with a continue expression runs it at the end of its
// body.
function joinLoops(items) {
  const joined = [];
  items.forEach((item, index) => {
    if (item.kind !== 'While' || !item.update) {
      joined.push(item);
      return;
    }
    const { condition, update, body } = item;
    if (!isCounting(joined.at(-1), item, items.slice(index + 1))) {
      const step = node('Assignment', update);
      joined.push(
        node('While', { condition, body: block([...body.statements, step]) })
      );
      return;
    }
    const start = joined.pop();
    const end =
      condition.operator === 'less'
        ? condition.right
        : add(condition.right, number(1));
    joined.push(
      node('CountingLoop', {
        variable: update.name,
        start: start.value,
        end,
        body,
      })
    );
  });
  return joined;
}

// Items, function heads and types.
const headParser = (Base) =>
  class ZigHeadParser extends Base {
    items(done) {
      return joinLoops(super.items(done));
    }

    // The tokens up to the end of the line.
    restOfLine() {
      const tokens = [];
      while (this.peek().type !== 'newline' && this.peek().type !== 'end') {
        tokens.push(this.next());
      }
      return tokens;
    }

    // `var out ...`, `out = ...` and `defer ...` open and close the writer.
    isWriterSetup() {
      return (
        this.is('defer') ||
        (this.is('out') && this.is('=', 1)) ||
        ((this.is('var') || this.is('const')) &&
          writerNames.has(this.peek(1).value))
      );
    }

    item() {
      if (this.isWriterSetup()) {
        this.restOfLine();
        return node('Statements', { statements: [] });
      }
      // const std = @import("std");
      if (this.is('const') && this.is('=', 2) && this.is('@', 3)) {
        const tokens = this.restOfLine();
        return node('Import', {
          text: tokens.map(({ value }) => value).join(' '),
        });
      }
      if (this.is('pub') || this.is('fn')) {
        return this.functionDefinition();
      }
      return super.item();
    }

    // [pub] fn name(a: i64, b: i64) i64 { ... }
    functionDefinition() {
      this.accept('pub');
      this.expect('fn');
      const functionName = this.expectName();
      const parameters = this.parameterList();
      const returnType = this.typeExpression();
      const body = this.block();
      return node('Function', {
        name: functionName,
        // main receives the process only to open the writer.
        parameters: functionName === 'main' ? [] : parameters,
        returnType,
        body,
      });
    }

    // i64, bool, []const u8 and void, as languages.js spells them.
    typeExpression() {
      const words = [];
      while (
        !['{', '=', ',', ')', ';'].includes(this.peek().value) &&
        !['newline', 'end'].includes(this.peek().type)
      ) {
        words.push(this.next().value);
      }
      const spelled = words.join('');
      const found = Object.entries(this.syntax.types).find(
        ([, written]) => written.replace(/\s+/g, '') === spelled
      );
      return found ? found[0] : sourceType(words.join(' '));
    }
  };

// Statements: allocations, tuples, prints and while loops.
const parser = (Base) =>
  class ZigParser extends headParser(Base) {
    statement() {
      // `_ = f(x);` drops a result, and `_ = x;` marks an unused parameter.
      if (this.is('_') && this.is('=', 1)) {
        this.position += 2;
        const expression = this.expression();
        this.endStatement();
        return expression.kind === 'Name'
          ? node('Statements', { statements: [] })
          : node('Evaluate', { expression });
      }
      if (this.is('out') && this.is('.', 1) && this.is('print', 2)) {
        return this.printStatement();
      }
      if (this.is('page_allocator', 7) && this.is('alloc', 9)) {
        return this.allocation();
      }
      return super.statement();
    }

    // const a = std.heap.page_allocator.alloc(i64, @intCast(n)) catch
    // unreachable; and the lines after it that free the array and fill it
    // with @memset(a, v): the array of n values v.
    allocation() {
      this.next();
      const variable = this.expectName();
      this.position += 9;
      this.expectName();
      this.expect(',');
      const length = this.expression();
      for (const word of [')', 'catch', 'unreachable']) {
        this.expect(word);
      }
      this.endStatement();
      let fill = number(0);
      const skipLines = () => {
        while (this.peek().type === 'newline') {
          this.next();
        }
      };
      skipLines();
      if (this.is('defer') && this.is('std', 1)) {
        this.restOfLine();
        skipLines();
      }
      if (this.is('@') && this.is('memset', 1) && this.is(variable, 3)) {
        this.position += 5;
        fill = this.expression();
        this.expect(')');
        this.endStatement();
      }
      return node('Declaration', {
        name: variable,
        type: 'array',
        value: node('NewArray', { length, fill }),
      });
    }

    // The values of `.{ a, b }`.
    tuple() {
      this.expect('.');
      this.expect('{');
      const values = [];
      while (!this.accept('}')) {
        values.push(this.expression());
        this.accept(',');
      }
      return values;
    }

    // out.print("format\n", .{ values }) catch {};
    printStatement() {
      this.position += 3;
      this.expect('(');
      const format = this.next();
      if (format.type !== 'text') {
        throw new SyntaxError('A format must be text', format.line);
      }
      this.expect(',');
      const values = this.tuple();
      for (const word of [')', 'catch', '{', '}']) {
        this.expect(word);
      }
      this.endStatement();
      const written = decodeEscapes(format.value);
      const newline = written.endsWith('\n');
      const parts = formatParts(
        newline ? written.slice(0, -1) : written,
        values
      );
      const value =
        parts.length > 1
          ? node('Interpolation', { parts })
          : (parts[0] ?? text(''));
      return node('Print', { value, newline });
    }

    // while (condition) : (i += 1) { ... }
    whileStatement() {
      this.next();
      this.expect('(');
      const condition = this.expression();
      this.expect(')');
      let update;
      if (this.accept(':')) {
        this.expect('(');
        update = this.forUpdate();
        this.expect(')');
      }
      return node('While', { condition, update, body: this.block() });
    }

    // @divTrunc(a, b) and @rem(a, b). @intCast(x) and @as(i64, x) only
    // change the integer type, and .{ a, b } is an array literal.
    primary() {
      if (this.is('@') && this.is('intCast', 1) && this.is('(', 2)) {
        this.position += 3;
        const value = this.expression();
        this.expect(')');
        return value;
      }
      if (this.is('@') && this.is('as', 1) && this.is('(', 2)) {
        this.position += 3;
        this.expectName();
        this.expect(',');
        const value = this.expression();
        this.expect(')');
        return value;
      }
      if (this.is('.') && this.is('{', 1)) {
        this.position += 2;
        return this.literal('}');
      }
      const operator = builtins[this.peek(1).value];
      if (!this.is('@') || !operator || !this.is('(', 2)) {
        return super.primary();
      }
      this.position += 3;
      const left = this.expression();
      this.expect(',');
      const right = this.expression();
      this.expect(')');
      return node('Binary', { operator, left, right });
    }
  };

// Statements: scoped declarations, prints through the writer and counting
// loops.
const statementEmitter = (Base) =>
  class ZigStatementEmitter extends Base {
    // The names declared in each open block, so that a variable two loops
    // share is declared once.
    declared(identifier) {
      return this.scopes.some((scope) => scope.has(identifier));
    }

    body(statements) {
      this.scopes ??= [];
      this.scopes.push(new Set());
      super.body(statements);
      this.scopes.pop();
    }

    // Zig always puts conditions in parentheses.
    condition(expression) {
      return `(${this.expression(expression)})`;
    }

    print({ value, newline }) {
      const parts = value.kind === 'Interpolation' ? value.parts : [value];
      const values = [];
      const format = parts
        .map((part) => {
          if (part.kind === 'Text') {
            return this.escape(part.value, { format: 'braces' });
          }
          values.push(this.expression(part));
          return placeholders[part.type] ?? '{any}';
        })
        .join('');
      const tuple =
        values.length > 1 ? `.{ ${values.join(', ')} }` : `.{${values}}`;
      const end = newline ? '\\n' : '';
      return `out.print("${format}${end}", ${tuple}) catch {};`;
    }

    statement(statement) {
      // A result the program does not use is discarded explicitly.
      const { kind, expression } = statement;
      if (
        kind === 'Evaluate' &&
        expression.type &&
        expression.type !== 'nothing'
      ) {
        return this.line(`_ = ${this.expression(expression)};`);
      }
      return super.statement(statement);
    }

    declaration({ name, type, value, mutable }) {
      const initial = this.expression(value ?? number(0));
      if (this.declared(name)) {
        return `${name} = ${initial};`;
      }
      this.scopes.at(-1).add(name);
      const keyword = mutable ? 'var' : 'const';
      return `${keyword} ${name}: ${this.type(type ?? 'integer')} = ${initial};`;
    }

    // An array of values is a Zig array of their count; an array of n
    // values is allocated, freed when the function ends and filled.
    arrayDeclaration(statement) {
      const { name, value } = statement;
      this.scopes.at(-1).add(name);
      if (value.kind === 'NewArray') {
        const length = this.expression(value.length);
        this.line(
          `const ${name} = ${allocator}.alloc(i64, @intCast(${length})) catch unreachable;`
        );
        this.line(`defer ${allocator}.free(${name});`);
        return `@memset(${name}, ${this.expression(value.fill)});`;
      }
      const changes = statement.mutable || statement.elementsAssigned;
      const count = value.elements.length;
      return `${changes ? 'var' : 'const'} ${name}: [${count}]i64 = ${this.expression(value)};`;
    }

    // Signed integers have no %= operator.
    assignment(statement) {
      if (statement.value.operator === 'remainder') {
        return `${statement.name} = ${this.expression(statement.value)};`;
      }
      return super.assignment(statement);
    }

    countingLoop({ variable, start, end, body }) {
      this.statement(
        node('Declaration', { name: variable, value: start, mutable: true })
      );
      // `i <= 10` reads better than `i < 11`, and `i < count` better than
      // `i <= count - 1`.
      const last = add(end, number(-1));
      const condition =
        last.kind === 'Binary'
          ? `${variable} < ${this.expression(end, 5)}`
          : `${variable} <= ${this.expression(last, 5)}`;
      this.openBlock(`while (${condition}) : (${variable} += 1)`);
      this.body(body);
      this.closeBlock();
    }
  };

const emitter = (Base) =>
  class ZigEmitter extends statementEmitter(Base) {
    binary(expression, parent) {
      if (expression.operator !== 'remainder') {
        return super.binary(expression, parent);
      }
      const { left, right } = expression;
      return `@rem(${this.expression(left)}, ${this.expression(right)})`;
    }

    signature(item) {
      const list = item.parameters
        .map(({ name, type }) => `${name}: ${this.type(type)}`)
        .join(', ');
      const returns = this.type(item.returnType ?? 'nothing');
      return `${this.syntax.functionKeyword ?? 'fn'} ${item.name}(${list}) ${returns}`;
    }

    // Zig rejects a parameter that is never read, so it is discarded.
    functionDefinition(item) {
      for (const comment of item.comments ?? []) {
        this.comment(comment);
      }
      this.openBlock(this.signature(item));
      for (const { name } of item.parameters) {
        if (!item.body.statements.some((part) => mentions(part, name))) {
          this.line(`_ = ${name};`);
        }
      }
      this.body(item.body);
      this.closeBlock();
    }

    program(program) {
      this.writes = false;
      this.allocates = false;
      walk(program, (current) => {
        this.writes ||= current.kind === 'Print';
        this.allocates ||= current.kind === 'NewArray';
      });
      return super.program(program);
    }

    main(program) {
      for (const comment of program.mainComments ?? []) {
        this.comment(comment);
      }
      this.openBlock(
        this.writes
          ? 'pub fn main(init: std.process.Init) void'
          : 'pub fn main() void'
      );
      if (this.writes) {
        writerSetup.forEach((line) => this.line(line));
        this.line();
      }
      this.body(program.main);
      this.closeBlock();
    }

    prelude(program) {
      // Printing and the allocator of filled arrays need the standard
      // library.
      const lines =
        this.writes || this.allocates ? ['const std = @import("std");'] : [];
      if (this.writes) {
        lines.push('', 'var out: *std.Io.Writer = undefined;');
      }
      lines.push(...(program.libraryImports ?? []));
      return lines.length ? [...lines, ''] : lines;
    }
  };

export const zig = { parser, emitter };
