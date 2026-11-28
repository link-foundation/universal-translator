// How the shared parser reads loops: while loops, C-style, numeric and range
// for loops, and Ruby's (first..last).each blocks. Counting loops become
// CountingLoop nodes; every other C-style loop becomes a while loop.

import { SyntaxError } from './lexer.js';
import { add, block, node, number } from '../meta/tree.js';

// The words and symbols that stand between the loop variable and what it
// loops over in the for-each templates of languages.js, such as `of`, `in`,
// `:` and `<-`.
const forEachOpener = (syntax) =>
  /\{variable\}\s*([^\s{]+)\s*\{array/.exec(syntax.forEach ?? '')?.[1];

// Increment and decrement statements, as the compound assignment they mean.
export const stepOperators = { '++': '+=', '--': '-=' };
export const assignmentSymbols = [
  '=',
  '+=',
  '-=',
  '*=',
  '/=',
  '//=',
  '%=',
  '++',
  '--',
];

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
      if (this.syntax.id === 'go') {
        return this.goFor();
      }
      // The loop variable may follow a declaration or a type: for my $i
      // (...), for (const x of ...), for (int x : ...)
      this.skipDeclarators();
      if (this.syntax.id === 'rust') {
        this.accept('&');
      }
      if (this.syntax.id === 'lua' && this.is(',', 1)) {
        return this.luaForEach();
      }
      const variable = this.expectName();
      return this.syntax.id === 'lua'
        ? this.numericFor(variable)
        : this.rangeFor(variable, parenthesized);
    }

    // Go: for condition { ... }, for i := range n, for _, x := range a
    goFor() {
      if (this.is(',', 1)) {
        this.next();
        this.next();
        const variable = this.expectName();
        this.expect(':=');
        this.expect('range');
        const array = this.expression();
        return node('ForEach', { variable, array, body: this.block() });
      }
      if (!this.is('range', 1) && !this.is(':=', 1)) {
        const condition = this.expression();
        return node('While', { condition, body: this.block() });
      }
      return this.rangeFor(this.expectName(), false);
    }

    // PHP: foreach ($a as $x), D: foreach (x; a), C#: foreach (T x in a)
    foreachStatement() {
      this.next();
      this.expect('(');
      const id = this.syntax.id;
      this.skipDeclarators();
      const first = this.expression();
      this.expect({ php: 'as', d: ';' }[id] ?? 'in');
      const second = this.expression();
      this.expect(')');
      const body = this.block();
      const [element, array] = id === 'php' ? [second, first] : [first, second];
      return node('ForEach', { variable: element.name, array, body });
    }

    // The words that declare a loop variable, or give its type, before it.
    skipDeclarators() {
      while (
        this.peek().type === 'name' &&
        this.peek(1).type === 'name' &&
        !['in', 'of', 'as'].includes(this.peek(1).value)
      ) {
        this.next();
      }
    }

    // Lua: for _, x in ipairs(a) do ... end
    luaForEach() {
      this.next();
      this.next();
      const variable = this.expectName();
      this.expect('in');
      this.expect('ipairs');
      this.expect('(');
      const array = this.expression();
      this.expect(')');
      const body = this.block();
      this.closeKeywordBlock();
      return node('ForEach', { variable, array, body });
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
      const each = forEachOpener(this.syntax);
      const over = each && each !== opener && this.is(each) ? each : opener;
      this.expect(over);
      if (this.syntax.id === 'rust') {
        this.accept('&');
      }
      const range = this.rangeExpression(over !== opener);
      if (opener === '(' || parenthesized) {
        this.expect(')');
      }
      const body = this.block();
      this.closeKeywordBlock();
      return range.array
        ? node('ForEach', { variable, ...range, body })
        : node('CountingLoop', { variable, ...range, body });
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

    isRangeOperator() {
      const { value } = this.peek();
      return (
        ['until', '..<', '...', '..', '..=', 'to'].includes(value) ||
        (value === ':' && ['julia', 'r'].includes(this.syntax.id))
      );
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

    // The range a loop counts over, or { array } when the loop visits the
    // elements of an array: `for x in a`, `for (const x of a)`.
    rangeExpression(isArray = false) {
      if (isArray) {
        return { array: this.expression() };
      }
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
      if (!this.isRangeOperator()) {
        return { array: start };
      }
      const operator = this.next().value;
      return this.rangeUpTo(start, operator, this.additive());
    }

    rangeUpTo(start, operator, last) {
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
