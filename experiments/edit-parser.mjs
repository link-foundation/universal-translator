// One-off source edit for the parser: the six new languages.
import { readFileSync, writeFileSync } from 'node:fs';

const path = 'js/src/grammar/parser.js';
let source = readFileSync(path, 'utf8');
const replace = (from, to) => {
  if (!source.includes(from)) {
    throw new Error(`missing: ${from.slice(0, 70)}`);
  }
  source = source.replace(from, to);
};

// Per-language operator spellings (R's %% and %/%, Dart's ~/).
replace(
  `  constructor(tokens, syntax) {
    this.tokens = tokens;
    this.position = 0;
    this.syntax = syntax;
  }`,
  `  constructor(tokens, syntax) {
    this.tokens = tokens;
    this.position = 0;
    this.syntax = syntax;
    const { remainder, integerDivide } = syntax.operators;
    const extra = { remainder, divide: integerDivide };
    this.levels = binaryLevels.map((level) =>
      Object.fromEntries(
        Object.entries(level).map(([operator, surfaces]) => [
          operator,
          extra[operator] ? [...surfaces, extra[operator]] : surfaces,
        ])
      )
    );
  }`
);
replace(
  `    if (level === binaryLevels.length) {`,
  `    if (level === this.levels.length) {`
);
replace(
  `      const operator = Object.entries(binaryLevels[level]).find(`,
  `      const operator = Object.entries(this.levels[level]).find(`
);

// R: name <- function(parameters) { ... }
replace(
  `  isFunctionStart() {
    return this.syntax.functionKeyword`,
  `  isFunctionStart() {
    if (this.syntax.functionForm === 'assigned') {
      return (
        this.peek().type === 'name' &&
        this.is(this.syntax.assignment, 1) &&
        this.is('function', 2)
      );
    }
    return this.syntax.functionKeyword`
);
replace(
  `    if (this.syntax.functionKeyword) {
      this.expect(this.syntax.functionKeyword);
      functionName = this.expectName();
    } else {`,
  `    if (this.syntax.functionForm === 'assigned') {
      functionName = this.expectName();
      this.expect(this.syntax.assignment);
      this.expect('function');
    } else if (this.syntax.functionKeyword) {
      this.expect(this.syntax.functionKeyword);
      functionName = this.expectName();
    } else {`
);
replace(
  `    const parameters =
      this.peek().type === 'newline' && this.syntax.id === 'ruby'
        ? []
        : this.parameterList();`,
  `    // Ruby and Perl may leave out the parentheses of a parameter list.
    let parameters = this.is('(') ? this.parameterList() : [];`
);
replace(
  `      returnType = this.typeExpression();
    }
    const body = this.block();
    this.closeKeywordBlock();
    return node('Function', {`,
  `      returnType = this.typeExpression();
    }
    // Scala: def name(...): Type = { ... }
    if (this.syntax.bodyAfter) {
      this.accept(this.syntax.bodyAfter);
    }
    const body = this.block();
    this.closeKeywordBlock();
    // Perl: sub name { my ($first, $second) = @_; ... }
    if (body.statements[0]?.kind === 'Parameters') {
      parameters = body.statements
        .shift()
        .names.map((parameterName) => ({ name: parameterName }));
    }
    return node('Function', {`
);

// Perl: my ($first, $second) = @_;
replace(
  `  declaration() {
    const keyword = this.next().value;`,
  `  declaration() {
    if (this.syntax.parameters === 'unpacked' && this.is('(', 1)) {
      return this.unpackedParameters();
    }
    const keyword = this.next().value;`
);
replace(
  `  simpleStatement() {`,
  `  // Perl passes arguments in @_; a function names them by unpacking it.
  unpackedParameters() {
    this.next();
    this.expect('(');
    const names = [this.expectName()];
    while (this.accept(',')) {
      names.push(this.expectName());
    }
    this.expect(')');
    this.expect('=');
    this.expect('@');
    this.expect('_');
    this.endStatement();
    return node('Parameters', { names });
  }

  simpleStatement() {`
);

// R: name <- value
replace(
  `    if (
      this.peek().type === 'name' &&
      assignmentSymbols.some((symbol) => this.is(symbol, 1))
    ) {`,
  `    if (
      this.peek().type === 'name' &&
      [...assignmentSymbols, this.syntax.assignment].some(
        (symbol) => symbol && this.is(symbol, 1)
      )
    ) {`
);
replace(
  `    const operator = stepOperators[written] ?? written;`,
  `    const operator =
      stepOperators[written] ??
      (written === this.syntax.assignment ? '=' : written);`
);
replace(
  `    if (this.syntax.id !== 'ruby' || this.peek().type !== 'name') {`,
  `    if (!this.syntax.commandCalls || this.peek().type !== 'name') {`
);

// for my $i (a .. b), for (i <- a until b)
replace(
  `    const variable = this.expectName();
    if (this.syntax.id === 'lua') {`,
  `    this.accept('my');
    const variable = this.expectName();
    if (this.syntax.id === 'lua') {`
);
replace(
  `    this.expect('in');
    const range = this.rangeExpression();
    if (parenthesized) {`,
  `    const opener = this.syntax.forIn ?? 'in';
    this.expect(opener);
    const range = this.rangeExpression();
    if (opener === '(' || parenthesized) {`
);
replace(
  `      case '..=':
        return { start, end: add(last, number(1)) };`,
  `      case '..=':
      case 'to': // Scala
      case ':': // Julia and R
        return { start, end: add(last, number(1)) };`
);

// Groovy: (a + b).intdiv(c) calls a method on a computed receiver.
replace(
  `        const separator = this.next().value;
        expression = name(`,
  `        const separator = this.next().value;
        if (expression.kind !== 'Name') {
          expression = node('Method', {
            receiver: expression,
            name: this.next().value,
          });
          continue;
        }
        expression = name(`
);
replace(
  `        this.expect(')');
        expression = node('Call', {
          callee: calleeName(expression),
          arguments: values,
        });`,
  `        this.expect(')');
        expression =
          expression.kind === 'Method'
            ? node('Call', {
                callee: \`.\${expression.name}\`,
                arguments: [expression.receiver, ...values],
              })
            : node('Call', {
                callee: calleeName(expression),
                arguments: values,
              });`
);

// Boolean words such as R's TRUE and FALSE.
replace(
  `        if (['true', 'True'].includes(token.value)) {
          return node('Boolean', { value: true });
        }
        if (['false', 'False'].includes(token.value)) {
          return node('Boolean', { value: false });
        }`,
  `        for (const value of [true, false]) {
          const spellings = [String(value), this.syntax.words?.[value]];
          if (spellings.includes(token.value)) {
            return node('Boolean', { value });
          }
        }`
);

// Interpolation styles of Scala and Julia.
replace(
  `  'backslash-parentheses': [['\\\\(', ')']],
};`,
  `  'backslash-parentheses': [['\\\\(', ')']],
  'dollar-doubled': [['\${', '}']],
  'dollar-parentheses': [['$(', ')']],
};
// Styles where $name embeds a variable.
const dollarStyles = new Set(['dollar', 'dollar-doubled', 'dollar-parentheses']);`
);
replace(
  `  if (
    style === 'braces' &&
    (value.startsWith('{{', index) || value.startsWith('}}', index))
  ) {
    return 2;
  }`,
  `  if (
    style === 'braces' &&
    (value.startsWith('{{', index) || value.startsWith('}}', index))
  ) {
    return 2;
  }
  if (style === 'dollar-doubled' && value.startsWith('$$', index)) {
    return 2;
  }`
);
replace(
  `      style === 'dollar' && /^\\$[A-Za-z_]\\w*/.exec(value.slice(index));`,
  `      dollarStyles.has(style) && /^\\$[A-Za-z_]\\w*/.exec(value.slice(index));`
);
writeFileSync(path, source);
