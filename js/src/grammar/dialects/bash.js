// Bash: functions read their arguments into local variables and leave
// their value in REPLY; integers are computed inside (( )) and $(( )).
// A call inside a value runs first as a command of its own, so `f(g(x))`
// becomes `g "$x"` and then `f "$REPLY"`. A value is a word: a number,
// quoted text, "$name" or $((arithmetic)).

import { add, block, node, number, text } from '../meta.js';
import { SyntaxError, tokenize } from '../lexer.js';
import { keywordParser } from './shared.js';

// Inside double quotes a backslash only escapes these characters.
const quotedEscapes = '$"\\`';
const ansiEscapes = { n: '\n', t: '\t', r: '\r', '\\': '\\', "'": "'" };
// The variable a function leaves its value in, and the variables that keep
// a value while the next call runs.
const reply = 'REPLY';
const isKept = (name) => /^REPLY_\d+$/.test(name);
// REPLY_1=$REPLY keeps the value of the call before it.
const keeps = ({ name, value }) =>
  isKept(name ?? '') && value?.kind === 'Name' && value.name === reply;
// The statements whose values may use REPLY, and the fields that hold them.
const statementKinds = new Set([
  'Print',
  'Return',
  'Declaration',
  'Assignment',
  'Evaluate',
  'If',
  'While',
  'CountingLoop',
]);
const valueFields = ['value', 'expression', 'condition', 'start', 'end'];

// Where the bracket that closes the one opened just before start is.
function closing(value, start) {
  let depth = 1;
  let index = start;
  for (; index < value.length && depth > 0; index += 1) {
    depth += value[index] === '(' ? 1 : value[index] === ')' ? -1 : 0;
  }
  if (depth !== 0) {
    throw new SyntaxError('Unclosed "(" in Bash text', 0);
  }
  return index;
}

// Put the calls back into the values that read REPLY or a kept value.
function restore(expression, values) {
  switch (expression?.kind) {
    case 'Name':
      if (expression.name === reply && values.current) {
        values.used = true;
        return values.current;
      }
      return values.kept.get(expression.name) ?? expression;
    case 'Binary':
      return {
        ...expression,
        left: restore(expression.left, values),
        right: restore(expression.right, values),
      };
    case 'Unary':
      return { ...expression, operand: restore(expression.operand, values) };
    case 'Call':
      return {
        ...expression,
        arguments: expression.arguments.map((part) => restore(part, values)),
      };
    case 'Interpolation':
      return {
        ...expression,
        parts: expression.parts.map((part) => restore(part, values)),
      };
    default:
      return expression;
  }
}

// A call followed by a statement that reads REPLY is a call inside that
// statement; a call whose value nobody reads is a statement of its own.
export function joinReplies(statements) {
  const joined = [];
  const values = { current: undefined, kept: new Map(), used: false };
  const flush = () => {
    if (values.current) {
      joined.push(node('Evaluate', { expression: values.current }));
    }
    values.current = undefined;
  };
  for (const statement of statements) {
    if (statement.kind === 'Skip') {
      continue;
    }
    if (!statementKinds.has(statement.kind)) {
      flush();
      joined.push(statement);
      continue;
    }
    if (keeps(statement) && values.current) {
      values.kept.set(statement.name, values.current);
      values.current = undefined;
      continue;
    }
    values.used = false;
    const restored = { ...statement };
    for (const field of valueFields) {
      if (statement[field]?.kind) {
        restored[field] = restore(statement[field], values);
      }
    }
    if (!values.used) {
      flush();
    }
    values.current = undefined;
    if (restored.kind === 'Evaluate' && restored.expression.kind === 'Call') {
      values.current = restored.expression;
    } else {
      joined.push(restored);
    }
  }
  flush();
  return joined;
}

// Words: what a command receives as arguments and what $(( )) computes
// with.
const words = (Base) =>
  class BashWords extends Base {
    // A parser for code embedded in text.
    inner(code) {
      return new this.constructor(tokenize(code, this.syntax), this.syntax);
    }

    primary() {
      if (this.is('$')) {
        return this.substitution();
      }
      const token = this.peek();
      if (token.type === 'text') {
        this.next();
        return token.quote === "'" ? text(token.value) : this.quoted(token);
      }
      return super.primary();
    }

    // $((arithmetic)), $(command; echo $REPLY), ${name} and $'text'.
    substitution() {
      this.expect('$');
      if (this.is('(') && this.is('(', 1)) {
        this.position += 2;
        const value = this.expression();
        this.expect(')');
        this.expect(')');
        return value;
      }
      if (this.accept('(')) {
        const call = this.command();
        if (this.accept(';')) {
          this.expect('echo');
          this.word();
        }
        this.expect(')');
        return call;
      }
      if (this.accept('{')) {
        const name = node('Name', { name: this.expectName() });
        this.expect('}');
        return name;
      }
      const token = this.next();
      if (token.type === 'text' && token.quote === "'") {
        return text(
          token.value.replace(/\\(.)/g, (_, code) => ansiEscapes[code] ?? code)
        );
      }
      throw new SyntaxError(`Unexpected "$${token.value}"`, token.line);
    }

    // One argument; a minus sign before a number belongs to it.
    word() {
      if (this.is('-') && this.peek(1).type === 'number') {
        this.next();
        return number(-Number(this.next().value));
      }
      return this.primary();
    }

    // A command and its arguments, up to the end of the command.
    command() {
      const callee = this.expectName();
      const values = [];
      while (
        !this.is(')') &&
        !this.is(';') &&
        !['newline', 'end', 'comment'].includes(this.peek().type)
      ) {
        values.push(this.word());
      }
      return node('Call', { callee, arguments: values });
    }

    // "Text with $name, ${name} and $((arithmetic))".
    quoted(token) {
      const value = token.value;
      const parts = [];
      let literal = '';
      const flush = () => {
        if (literal) {
          parts.push(text(literal));
        }
        literal = '';
      };
      let index = 0;
      while (index < value.length) {
        const rest = value.slice(index);
        if (rest[0] === '\\') {
          literal += quotedEscapes.includes(rest[1])
            ? rest[1]
            : rest.slice(0, 2);
          index += 2;
        } else if (rest.startsWith('$(')) {
          const end = closing(value, index + 2);
          flush();
          parts.push(this.inner(value.slice(index, end)).substitution());
          index = end;
        } else if (/^\$\{?[A-Za-z_]/.test(rest)) {
          const [found, braced, plain] = /^\$(?:\{(\w+)\}|(\w+))/.exec(rest);
          flush();
          parts.push(node('Name', { name: braced ?? plain }));
          index += found.length;
        } else {
          literal += rest[0];
          index += 1;
        }
      }
      flush();
      if (parts.length <= 1) {
        return parts[0] ?? text('');
      }
      return node('Interpolation', { parts });
    }
  };

// Statements: assignments, local declarations, if, while, for, output,
// returns and commands.
const statements = (Base) =>
  class BashStatements extends Base {
    statement() {
      if (this.accept('if')) {
        return this.bashIf();
      }
      if (this.accept('while')) {
        const condition = this.arithmetic();
        return node('While', { condition, body: this.doBlock() });
      }
      if (this.accept('for')) {
        return this.bashFor();
      }
      if (this.accept('return')) {
        return node('Return', {});
      }
      if (this.accept('local')) {
        // `local i` before a loop keeps its counter inside the function.
        if (!this.is('=', 1)) {
          this.next();
          return node('Skip');
        }
        const name = this.expectName();
        this.expect('=');
        return node('Declaration', { name, value: this.word(), mutable: true });
      }
      if (this.peek().type === 'name' && this.is('=', 1)) {
        const name = this.next().value;
        this.next();
        const value = this.word();
        // REPLY=value; return
        return name === reply && this.returns()
          ? node('Return', { value })
          : node('Assignment', { name, operator: '=', value });
      }
      if (this.is('echo') || this.is('printf')) {
        return this.output();
      }
      // f arguments; return
      const call = this.command();
      return this.returns()
        ? node('Return', { value: call })
        : node('Evaluate', { expression: call });
    }

    // `; return` on the line of the command that leaves the value.
    returns() {
      if (this.is(';') && this.is('return', 1)) {
        this.position += 2;
        return true;
      }
      return false;
    }

    // echo word, and printf '%s' word, which ends no line.
    output() {
      const newline = this.next().value === 'echo' || this.formatEndsLine();
      const ends =
        this.is(';') || ['newline', 'end'].includes(this.peek().type);
      return node('Print', { value: ends ? text('') : this.word(), newline });
    }

    // The format of printf: '%s' writes its argument, '%s\n' a line.
    formatEndsLine() {
      const format = this.next();
      if (format.type !== 'text' || !/^%s(\\n)?$/.test(format.value)) {
        throw new SyntaxError(
          `Unsupported printf format "${format.value}"`,
          format.line
        );
      }
      return format.value.endsWith('\\n');
    }

    // (( expression ))
    arithmetic() {
      this.expect('(');
      this.expect('(');
      const value = this.expression();
      this.expect(')');
      this.expect(')');
      return value;
    }

    // The statements of a block up to the word that ends it.
    upTo(...ends) {
      const found = this.statementsUntil(() =>
        ends.some((end) => this.is(end))
      );
      return block(joinReplies(found));
    }

    // ; do ... done
    doBlock() {
      this.skipLines();
      this.expect('do');
      const body = this.upTo('done');
      this.expect('done');
      return body;
    }

    // if (( c )); then ... elif (( c )); then ... else ... fi
    bashIf() {
      const condition = this.arithmetic();
      this.skipLines();
      this.expect('then');
      const then = this.upTo('elif', 'else', 'fi');
      if (this.accept('elif')) {
        return node('If', { condition, then, otherwise: this.bashIf() });
      }
      const otherwise = this.accept('else') ? this.upTo('fi') : undefined;
      this.expect('fi');
      return node('If', { condition, then, otherwise });
    }

    // for (( i = a; i < b; i++ )); do ... done
    bashFor() {
      this.expect('(');
      this.expect('(');
      const variable = this.expectName();
      this.expect('=');
      const start = this.expression();
      this.expect(';');
      this.expect(variable);
      const inclusive = this.next().value === '<=';
      const bound = this.expression();
      this.expect(';');
      this.expect(variable);
      this.expect('++');
      this.expect(')');
      this.expect(')');
      const end = inclusive ? add(bound, number(1)) : bound;
      return node('CountingLoop', {
        variable,
        start,
        end,
        body: this.doBlock(),
      });
    }
  };

const parser = (Base) =>
  class BashParser extends statements(words(keywordParser(Base))) {
    // The script runs from top to bottom; `name() { ... }` defines a
    // function, and `source` loads the common library.
    program() {
      const items = [];
      while (this.peek().type !== 'end') {
        this.gatherComments(items);
        if (this.peek().type === 'end') {
          break;
        }
        if ((this.is('source') || this.is('.')) && !this.is('=', 1)) {
          const start = this.position;
          this.skipLine();
          const used = this.tokens.slice(start, this.position);
          items.push(
            node('Import', { text: used.map(({ value }) => value).join(' ') })
          );
        } else if (this.is('(', 1) && this.is(')', 2)) {
          items.push(this.functionDefinition());
        } else {
          items.push(this.statement());
        }
        this.skipLines();
      }
      // The #! line names the interpreter; it is not a comment.
      const program = joinReplies(items).filter(
        (item) => item.kind !== 'Comment' || !item.text.startsWith('!')
      );
      return node('SourceProgram', {
        language: this.syntax.id,
        items: program,
      });
    }

    // name() { local first=$1 second=$2; ... }
    functionDefinition() {
      const name = this.expectName();
      this.expect('(');
      this.expect(')');
      this.expect('{');
      this.skipLines();
      const parameters = [];
      if (this.is('local') && this.is('$', 3)) {
        this.next();
        while (this.peek().type === 'name' && this.is('=', 1)) {
          parameters.push({ name: this.next().value });
          this.position += 3;
        }
      }
      const body = this.upTo('}');
      this.expect('}');
      return node('Function', { name, parameters, body });
    }
  };

// Whether a tree holds the very node given.
function holds(tree, target) {
  if (tree === target) {
    return true;
  }
  if (!tree || typeof tree !== 'object') {
    return false;
  }
  return Object.values(tree).some((value) => holds(value, target));
}

// Words: how a value is written as an argument, inside text, and inside
// arithmetic.
const wordEmitter = (Base) =>
  class BashWordEmitter extends Base {
    terminator() {
      return '';
    }

    variable(identifier) {
      return identifier;
    }

    // Plain text in single quotes; text with a line end in $'...'.
    quote(value) {
      if (/[\n\t\r]/.test(value)) {
        const escaped = value
          .replace(/\\/g, '\\\\')
          .replace(/'/g, "\\'")
          .replace(/\n/g, '\\n')
          .replace(/\t/g, '\\t')
          .replace(/\r/g, '\\r');
        return `$'${escaped}'`;
      }
      if (!/['\\]/.test(value)) {
        return `'${value}'`;
      }
      return `"${value.replace(/[$"\\`]/g, '\\$&')}"`;
    }

    // Arithmetic: names are bare. A call that cannot run before the
    // statement (in a loop condition) runs in a subshell that prints REPLY.
    expression(expression, parent = 0) {
      switch (expression.kind) {
        case 'Call':
          return `$(${this.command(expression, true)}; echo $${reply})`;
        case 'Text':
        case 'Interpolation':
          throw new Error('Bash arithmetic cannot hold text');
        default:
          return super.expression(expression, parent);
      }
    }

    // A command with its arguments. Inside quotes or another command the
    // arguments are not quoted again.
    command({ callee, arguments: values }, nested = false) {
      return [callee, ...values.map((value) => this.word(value, nested))].join(
        ' '
      );
    }

    // A value as one word.
    word(value, nested = false) {
      const quoted = (inner) => (nested ? inner : `"${inner}"`);
      switch (value.kind) {
        case 'Number':
          return String(value.value);
        case 'Boolean':
          return this.syntax.words[String(value.value)];
        case 'Text':
          return this.quote(value.value);
        case 'Name':
          return quoted(`$${value.name}`);
        case 'Call':
          return quoted(this.expression(value));
        case 'Interpolation':
          return this.interpolation(value.parts);
        default: {
          // $(((a ... reads as $(( (a ..., so the inner bracket stands apart.
          const inner = this.expression(value);
          return inner.startsWith('(') ? `$(( ${inner} ))` : `$((${inner}))`;
        }
      }
    }

    // "Text with $name and $((arithmetic))".
    interpolation(parts) {
      const pieces = parts.map((part, index) => {
        if (part.kind === 'Text') {
          return part.value.replace(/[$"\\`]/g, '\\$&');
        }
        if (part.kind === 'Name') {
          const following = parts[index + 1];
          const joined =
            following?.kind === 'Text' && /^\w/.test(following.value);
          return joined ? `\${${part.name}}` : `$${part.name}`;
        }
        if (part.kind === 'Interpolation') {
          throw new Error('Bash text cannot hold other text');
        }
        return this.word(part, true);
      });
      return `"${pieces.join('')}"`;
    }

    // Calls inside a value run first, innermost first; each leaves its
    // value in REPLY, which the next call or the statement reads.
    lift(expression) {
      switch (expression?.kind) {
        case 'Call': {
          const values = expression.arguments.map((part) => this.lift(part));
          this.run({ ...expression, arguments: values });
          this.pending = node('Name', { name: reply });
          return this.pending;
        }
        case 'Binary':
          return {
            ...expression,
            left: this.lift(expression.left),
            right: this.lift(expression.right),
          };
        case 'Unary':
          return { ...expression, operand: this.lift(expression.operand) };
        case 'Interpolation':
          return {
            ...expression,
            parts: expression.parts.map((part) => this.lift(part)),
          };
        default:
          return expression;
      }
    }

    // A command line. A value in REPLY that this command does not read is
    // kept in a variable of its own first.
    run(call) {
      if (this.pending && !holds(call, this.pending)) {
        this.keep();
      }
      this.pending = undefined;
      this.line(this.command(call));
    }

    keep() {
      this.kept += 1;
      const name = `${reply}_${this.kept}`;
      this.line(`${this.inFunction ? 'local ' : ''}${name}=$${reply}`);
      this.pending.name = name;
      this.pending = undefined;
    }
  };

// Statements: assignments, if, while, for and output.
const statementEmitter = (Base) =>
  class BashStatementEmitter extends wordEmitter(Base) {
    statement(statement) {
      this.pending = undefined;
      this.kept = 0;
      switch (statement.kind) {
        case 'Evaluate':
          if (statement.expression.kind !== 'Call') {
            break;
          }
          this.lift(statement.expression);
          this.pending = undefined;
          return undefined;
        case 'Print':
        case 'Declaration':
        case 'Assignment':
          return super.statement({
            ...statement,
            value: this.lift(statement.value),
          });
        case 'Return':
          return this.returnValue(statement.value);
        case 'If':
          return this.ifStatement({
            ...statement,
            condition: this.lift(statement.condition),
          });
        case 'CountingLoop':
          return this.countingLoop(statement);
        default:
          break;
      }
      return super.statement(statement);
    }

    // A function leaves its value in REPLY; `f x; return` returns the value
    // f left there.
    returnValue(value) {
      if (!value) {
        return this.line('return');
      }
      const lifted = this.lift(value);
      if (lifted === this.pending) {
        this.lines[this.lines.length - 1] += '; return';
        return undefined;
      }
      return this.line(`${reply}=${this.word(lifted, true)}; return`);
    }

    print({ value, newline }) {
      const empty = value.kind === 'Text' && value.value === '';
      if (newline) {
        return empty ? 'echo' : `echo ${this.word(value)}`;
      }
      return `printf '%s' ${this.word(value)}`;
    }

    // Variables of a function are local to it.
    declaration({ name, value }) {
      const local = this.inFunction ? 'local ' : '';
      return `${local}${name}=${this.word(value ?? number(0), true)}`;
    }

    assignment({ name, value }) {
      return `${name}=${this.word(value, true)}`;
    }

    indented(body) {
      this.depth += 1;
      this.body(body);
      if (body.statements.length === 0) {
        this.line(':');
      }
      this.depth -= 1;
    }

    ifStatement(statement) {
      this.line(`if (( ${this.expression(statement.condition)} )); then`);
      let current = statement;
      this.indented(current.then);
      while (current.otherwise?.kind === 'If') {
        current = current.otherwise;
        this.line(`elif (( ${this.expression(current.condition)} )); then`);
        this.indented(current.then);
      }
      if (current.otherwise) {
        this.line('else');
        this.indented(current.otherwise);
      }
      this.line('fi');
    }

    whileStatement({ condition, body }) {
      this.line(`while (( ${this.expression(condition)} )); do`);
      this.indented(body);
      this.line('done');
    }

    // The bounds are computed once, before the loop; the body may change
    // REPLY, so a bound from a call keeps its value in a variable.
    countingLoop({ variable, start, end, body }) {
      if (this.inFunction) {
        this.line(`local ${variable}`);
      }
      const first = this.lift(start);
      const bound = this.lift(end);
      if (this.pending) {
        this.keep();
      }
      const from = this.expression(first);
      const to = this.expression(bound, 5);
      this.line(
        `for (( ${variable} = ${from}; ${variable} < ${to}; ${variable}++ )); do`
      );
      this.indented(body);
      this.line('done');
    }
  };

const emitter = (Base) =>
  class BashEmitter extends statementEmitter(Base) {
    functionDefinition(item) {
      for (const comment of item.comments ?? []) {
        this.comment(comment);
      }
      this.line(`${item.name}() {`);
      if (item.parameters.length) {
        const locals = item.parameters.map(
          ({ name }, index) => `${name}=$${index + 1}`
        );
        this.line(`${this.unit}local ${locals.join(' ')}`);
      }
      this.inFunction = true;
      this.indented(item.body);
      this.inFunction = false;
      this.line('}');
    }

    program(program) {
      return `#!/usr/bin/env bash\n${super.program(program)}`;
    }
  };

export const bash = { parser, emitter };
