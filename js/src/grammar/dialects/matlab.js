// MATLAB and GNU Octave: a script whose functions come first (Octave
// defines them as the script runs, so `1;` keeps the file a script), and
// whose output goes through fprintf with a format. A function returns by
// setting its output variable and leaving with `return`. Numbers are
// doubles: fix(a / b) divides and rem(a, b) is the remainder.

import { add, block, node, number, text } from '../meta.js';
import { SyntaxError } from '../lexer.js';
import { eachStatement, keywordParser } from './shared.js';

// The output variable of every function that returns a value.
const result = 'result';
// Escapes of a format: a line end, a tab, a backslash.
const formatEscapes = { n: '\n', t: '\t', r: '\r', '\\': '\\' };

// The parts of a format and its values: %d and %s take the next value.
function formatParts(format, values) {
  const parts = [];
  let literal = '';
  let index = 0;
  const pattern = /%%|%[ds]|\\./y;
  while (index < format.length) {
    pattern.lastIndex = index;
    const found = pattern.exec(format)?.[0];
    if (!found) {
      literal += format[index];
      index += 1;
      continue;
    }
    index += found.length;
    if (found === '%%') {
      literal += '%';
    } else if (found.startsWith('\\')) {
      literal += formatEscapes[found[1]] ?? found;
    } else {
      if (literal) {
        parts.push(text(literal));
      }
      literal = '';
      parts.push(values.shift());
    }
  }
  if (literal) {
    parts.push(text(literal));
  }
  return parts;
}

// Statements: if, while, for, fprintf, return, assignments and calls.
const statements = (Base) =>
  class MatlabStatements extends Base {
    statement() {
      if (this.accept('if')) {
        return this.matlabIf();
      }
      if (this.accept('while')) {
        const condition = this.expression();
        return node('While', { condition, body: this.untilEnd() });
      }
      if (this.accept('for')) {
        return this.matlabFor();
      }
      if (this.accept('return')) {
        return node('Return', {});
      }
      if (this.is('fprintf') || this.is('disp')) {
        return this.output();
      }
      if (this.peek().type === 'name' && this.is('=', 1)) {
        const name = this.next().value;
        this.next();
        const value = this.expression();
        // A function returns by setting its output variable and leaving.
        if (name === this.result) {
          this.skipLines();
          this.accept('return');
          return node('Return', { value });
        }
        return node('Assignment', { name, operator: '=', value });
      }
      return node('Evaluate', { expression: this.called(this.expression()) });
    }

    // fprintf('format\n', values) and disp(value).
    output() {
      const callee = this.next().value;
      this.expect('(');
      if (callee === 'disp') {
        const value = this.expression();
        this.expect(')');
        return node('Print', { value, newline: true });
      }
      const [format, ...values] = this.formatted();
      const newline = format.endsWith('\\n');
      const parts = formatParts(newline ? format.slice(0, -2) : format, values);
      const value =
        parts.length > 1 || parts[0]?.kind === 'Text'
          ? node('Interpolation', { parts })
          : (parts[0] ?? text(''));
      return node('Print', { value: this.merged(value), newline });
    }

    // Text in one piece is plain text.
    merged(value) {
      if (value.kind !== 'Interpolation') {
        return value;
      }
      return value.parts.every((part) => part.kind === 'Text')
        ? text(value.parts.map((part) => part.value).join(''))
        : value;
    }

    // The format (as written) and the values of fprintf or sprintf, after
    // the opening bracket.
    formatted() {
      const format = this.next();
      if (format.type !== 'text') {
        throw new SyntaxError('A format must be text', format.line);
      }
      const values = [];
      while (this.accept(',')) {
        values.push(this.expression());
      }
      this.expect(')');
      return [format.value, ...values];
    }

    // for name = first:last ... end: the meta loop stops before its end.
    matlabFor() {
      const variable = this.expectName();
      this.expect('=');
      const start = this.expression();
      this.expect(':');
      const last = this.expression();
      return node('CountingLoop', {
        variable,
        start,
        end: add(last, number(1)),
        body: this.untilEnd(),
      });
    }

    untilEnd() {
      const statements = this.statementsUntil(() => this.is('end'));
      this.expect('end');
      return block(statements);
    }

    // if ... elseif ... else ... end: the chain shares one `end`.
    matlabIf() {
      const condition = this.expression();
      const then = block(
        this.statementsUntil(
          () => this.is('elseif') || this.is('else') || this.is('end')
        )
      );
      if (this.accept('elseif')) {
        return node('If', { condition, then, otherwise: this.matlabIf() });
      }
      if (this.accept('else')) {
        return node('If', { condition, then, otherwise: this.untilEnd() });
      }
      this.expect('end');
      return node('If', { condition, then });
    }

    // rem(a, b) is the remainder and sprintf(format, ...) is text.
    primary() {
      if (this.is('rem') && this.is('(', 1)) {
        this.position += 2;
        const left = this.expression();
        this.expect(',');
        const right = this.expression();
        this.expect(')');
        return node('Binary', { operator: 'remainder', left, right });
      }
      if (this.is('sprintf') && this.is('(', 1)) {
        this.position += 2;
        const [format, ...values] = this.formatted();
        const parts = formatParts(format, values);
        return this.merged(node('Interpolation', { parts }));
      }
      return super.primary();
    }
  };

const parser = (Base) =>
  class MatlabParser extends statements(keywordParser(Base)) {
    // `1;`, functions, then the statements of the script; source(...)
    // loads the common library.
    program() {
      const items = [];
      while (this.peek().type !== 'end') {
        this.gatherComments(items);
        if (this.peek().type === 'end') {
          break;
        }
        if (this.peek().type === 'number' && this.is(';', 1)) {
          this.next();
        } else if (this.is('source') && this.is('(', 1)) {
          const start = this.position;
          this.skipLine();
          const used = this.tokens.slice(start, this.position);
          items.push(
            node('Import', { text: used.map(({ value }) => value).join(' ') })
          );
        } else if (this.accept('function')) {
          items.push(this.functionDefinition());
        } else {
          items.push(this.statement());
        }
        this.skipLines();
      }
      return node('SourceProgram', { language: this.syntax.id, items });
    }

    // function output = name(a, b) ... end, or function name(a, b) ... end.
    functionDefinition() {
      this.result = this.is('=', 1) ? this.next().value : undefined;
      if (this.result) {
        this.expect('=');
      }
      const name = this.expectName();
      const parameters = [];
      if (this.accept('(')) {
        while (!this.accept(')')) {
          parameters.push({ name: this.expectName() });
          this.accept(',');
        }
      }
      const body = this.untilEnd();
      this.result = undefined;
      return node('Function', { name, parameters, body });
    }
  };

// Text in a format: % and \ are doubled, a line end is \n.
function formatText(value) {
  return value
    .replace(/'/g, "''")
    .replace(/%/g, '%%')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
    .replace(/\r/g, '\\r');
}

// Statements: if, while, for, fprintf and the output variable.
const statementEmitter = (Base) =>
  class MatlabStatementEmitter extends Base {
    // 'format', values: text is written into the format, values take %s
    // when they are text and %d otherwise.
    format(parts, ending = '') {
      const values = [];
      const pieces = parts.map((part) => {
        if (part.kind === 'Text') {
          return formatText(part.value);
        }
        values.push(this.expression(part));
        return part.type === 'text' ? '%s' : '%d';
      });
      return [`'${pieces.join('')}${ending}'`, ...values].join(', ');
    }

    print({ value, newline }) {
      const parts = value.kind === 'Interpolation' ? value.parts : [value];
      return `fprintf(${this.format(parts, newline ? '\\n' : '')});`;
    }

    returnStatement({ value }) {
      if (value) {
        this.line(`${result} = ${this.expression(value)};`);
      }
      return 'return;';
    }

    declaration({ name, value }) {
      return `${name} = ${this.expression(value ?? number(0))};`;
    }

    indented(body) {
      this.depth += 1;
      this.body(body);
      this.depth -= 1;
    }

    ifStatement(statement) {
      this.line(`if ${this.expression(statement.condition)}`);
      let current = statement;
      this.indented(current.then);
      while (current.otherwise?.kind === 'If') {
        current = current.otherwise;
        this.line(`elseif ${this.expression(current.condition)}`);
        this.indented(current.then);
      }
      if (current.otherwise) {
        this.line('else');
        this.indented(current.otherwise);
      }
      this.line('end');
    }

    whileStatement({ condition, body }) {
      this.line(`while ${this.expression(condition)}`);
      this.indented(body);
      this.line('end');
    }

    countingLoop({ variable, start, end, body }) {
      const last = this.expression(add(end, number(-1)));
      this.line(`for ${variable} = ${this.expression(start)}:${last}`);
      this.indented(body);
      this.line('end');
    }
  };

const emitter = (Base) =>
  class MatlabEmitter extends statementEmitter(Base) {
    // Single quotes keep backslashes; text with a line end is a format.
    quote(value) {
      if (/[\n\t\r]/.test(value)) {
        return `sprintf('${formatText(value)}')`;
      }
      return `'${value.replace(/'/g, "''")}'`;
    }

    interpolation(parts) {
      return `sprintf(${this.format(parts)})`;
    }

    binary(expression, parent) {
      if (expression.operator !== 'remainder') {
        return super.binary(expression, parent);
      }
      const { left, right } = expression;
      return `rem(${this.expression(left)}, ${this.expression(right)})`;
    }

    functionDefinition(item) {
      for (const comment of item.comments ?? []) {
        this.comment(comment);
      }
      let returns = false;
      eachStatement(item.body, (statement) => {
        returns ||= statement.kind === 'Return' && Boolean(statement.value);
      });
      const list = item.parameters.map(({ name }) => name).join(', ');
      const output = returns ? `${result} = ` : '';
      this.line(`function ${output}${item.name}(${list})`);
      this.indented(item.body);
      this.line('end');
    }

    program(program) {
      for (const comment of program.comments) {
        this.comment(comment);
      }
      if (program.comments.length) {
        this.line();
      }
      // A file whose first statement defines a function is a function file.
      this.line('1;');
      for (const line of program.libraryImports ?? []) {
        this.line(line);
      }
      for (const item of program.functions) {
        this.line();
        this.functionDefinition(item);
      }
      this.line();
      for (const comment of program.mainComments ?? []) {
        this.comment(comment);
      }
      this.body(program.main);
      return `${this.lines.join('\n')}\n`;
    }
  };

export const matlab = { parser, emitter };
