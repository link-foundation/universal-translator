// How the shared parser reads loops: while loops, C-style, numeric and range
// for loops, and Ruby's (first..last).each blocks. Counting loops become
// CountingLoop nodes; every other C-style loop becomes a while loop.

import { SyntaxError } from './lexer.js';
import { add, block, node, number } from '../meta/tree.js';

// Increment and decrement statements, as the compound assignment they mean.
export const stepOperators = { '++': '+=', '--': '-=' };

// `for (i = a; i < b; i++)` is a counting loop. Every other C-style loop
// becomes its initial assignment followed by a while loop that ends with
// the update.
function countingLoop(initial, condition, update, body) {
  const variable = initial.name;
  const counting =
    (initial.kind === 'Declaration' || initial.kind === 'Assignment') &&
    condition.kind === 'Binary' &&
    ['less', 'lessOrEqual'].includes(condition.operator) &&
    condition.left.kind === 'Name' &&
    condition.left.name === variable &&
    update.name === variable &&
    update.operator === '+=' &&
    update.value.kind === 'Number' &&
    update.value.value === 1;
  if (counting) {
    const end =
      condition.operator === 'less'
        ? condition.right
        : add(condition.right, number(1));
    return node('CountingLoop', { variable, start: initial.value, end, body });
  }
  const start =
    initial.kind === 'Declaration'
      ? node('Assignment', {
          name: initial.name,
          operator: '=',
          value: initial.value,
        })
      : initial;
  const step = node('Assignment', update);
  const loop = node('While', {
    condition,
    body: block([...body.statements, step]),
  });
  return node('Statements', { statements: [start, loop] });
}

// While loops and for loops; the ranges they count over are read below.
const withLoopStatements = (Base) =>
  class extends Base {
    whileStatement() {
      this.next();
      const condition = this.condition();
      const body = this.block();
      this.closeKeywordBlock();
      return node('While', { condition, body });
    }

    forStatement() {
      this.next();
      const parenthesized =
        this.syntax.id !== 'go' &&
        this.is('(') &&
        (this.syntax.id === 'kotlin' || this.syntax.blocks === 'braces');
      if (parenthesized) {
        this.expect('(');
      }
      // C family: for (init; condition; update)
      const isClassic = this.tokensUntilBlock().some(
        (token) => token.value === ';'
      );
      if (isClassic) {
        const initial = this.statement();
        const condition = this.expression();
        this.expect(';');
        const update = this.forUpdate();
        if (parenthesized) {
          this.expect(')');
        }
        const body = this.block();
        return countingLoop(initial, condition, update, body);
      }
      if (
        this.syntax.id === 'go' &&
        !this.is('range', 1) &&
        !this.is(':=', 1)
      ) {
        const condition = this.expression();
        return node('While', { condition, body: this.block() });
      }
      // Perl declares the loop variable: for my $i (...)
      if (
        this.syntax.declarations.includes(this.peek().value) &&
        this.peek(1).type === 'name'
      ) {
        this.next();
      }
      const variable = this.expectName();
      return this.syntax.id === 'lua'
        ? this.numericFor(variable)
        : this.rangeFor(variable, parenthesized);
    }

    // Lua: for i = first, last do ... end
    numericFor(variable) {
      this.expect('=');
      const start = this.expression();
      this.expect(',');
      const last = this.expression();
      const body = this.block();
      this.closeKeywordBlock();
      return node('CountingLoop', {
        variable,
        start,
        end: add(last, number(1)),
        body,
      });
    }

    // for i in range, for my $i (range), for (i <- range)
    rangeFor(variable, parenthesized) {
      const opener = this.syntax.forIn ?? 'in';
      this.expect(opener);
      const range = this.rangeExpression();
      if (opener === '(' || parenthesized) {
        this.expect(')');
      }
      const body = this.block();
      this.closeKeywordBlock();
      return node('CountingLoop', { variable, ...range, body });
    }
  };

// Ruby's range blocks, loop updates and the ranges a loop counts over.
const withRanges = (Base) =>
  class extends Base {
    // Ruby: (first..last).each do |variable| ... end
    isRangeEach() {
      if (!this.is('(')) {
        return false;
      }
      let depth = 0;
      for (let offset = 0; ; offset += 1) {
        const token = this.peek(offset);
        if (token.type === 'end' || token.type === 'newline') {
          return false;
        }
        if (token.value === '(') {
          depth += 1;
        }
        if (token.value === ')' && --depth === 0) {
          return this.is('.', offset + 1) && this.is('each', offset + 2);
        }
      }
    }

    rangeEach() {
      this.expect('(');
      const range = this.rangeExpression();
      this.expect(')');
      this.expect('.');
      this.expect('each');
      this.expect('do');
      this.expect('|');
      const variable = this.expectName();
      this.expect('|');
      const body = this.block();
      this.closeKeywordBlock();
      return node('CountingLoop', { variable, ...range, body });
    }

    tokensUntilBlock() {
      const tokens = [];
      for (let offset = 0; ; offset += 1) {
        const token = this.peek(offset);
        if (
          token.type === 'end' ||
          token.value === '{' ||
          token.type === 'newline'
        ) {
          return tokens;
        }
        tokens.push(token);
      }
    }

    forUpdate() {
      const name = this.expectName();
      const written = this.next().value;
      if (stepOperators[written]) {
        return { name, operator: stepOperators[written], value: number(1) };
      }
      if (!['+=', '-=', '*=', '/=', '='].includes(written)) {
        throw new SyntaxError(
          `Unsupported loop update "${written}"`,
          this.peek().line
        );
      }
      return { name, operator: written, value: this.expression() };
    }

    rangeExpression() {
      if (this.is('range')) {
        this.next();
        this.expect('(');
        const first = this.expression();
        const second = this.accept(',') ? this.expression() : undefined;
        this.expect(')');
        return second
          ? { start: first, end: second }
          : { start: number(0), end: first };
      }
      const start = this.additive();
      const operator = this.next().value;
      const last = this.additive();
      switch (operator) {
        case 'until':
        case '..<':
          return { start, end: last };
        case '...':
          return this.syntax.id === 'ruby'
            ? { start, end: last }
            : { start, end: add(last, number(1)) };
        case '..':
          return this.syntax.id === 'rust'
            ? { start, end: last }
            : { start, end: add(last, number(1)) };
        case '..=':
        case 'to': // Scala
        case ':': // Julia and R
          return { start, end: add(last, number(1)) };
        default:
          throw new SyntaxError(
            `Unsupported range operator "${operator}"`,
            this.peek().line
          );
      }
    }
  };

export const withLoops = (Base) => withRanges(withLoopStatements(Base));
