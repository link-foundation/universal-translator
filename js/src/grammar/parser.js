// Recursive-descent parser driven by the language descriptions in
// languages.js. It produces the meta tree described in meta.js, keeping the
// surface concepts (calls, imports, classes) that later rule layers
// interpret. The parser never decides what a program means.

import { decodeEscapes, SyntaxError, tokenize } from './lexer.js';
import { add, block, name, node, number, text } from './meta.js';

const binaryLevels = [
  { or: ['||', 'or'] },
  { and: ['&&', 'and'] },
  { equal: ['==', '==='], notEqual: ['!=', '!==', '~='] },
  { less: ['<'], lessOrEqual: ['<='], greater: ['>'], greaterOrEqual: ['>='] },
  { add: ['+', '..'], subtract: ['-'] },
  { multiply: ['*'], divide: ['/', '//'], remainder: ['%'] },
];

const typeWords = new Set([
  'int', 'long', 'short', 'char', 'void', 'bool', 'boolean', 'double', 'float',
  'string', 'String', 'var', 'auto', 'const', 'unsigned', 'signed', 'std',
]);
const modifiers = new Set(['public', 'private', 'protected', 'static', 'internal', 'final', 'export', 'inline', 'async']);

export function parseProgram(source, syntax) {
  return new Parser(tokenize(source, syntax), syntax).program();
}

class Parser {
  constructor(tokens, syntax) {
    this.tokens = tokens;
    this.position = 0;
    this.syntax = syntax;
  }

  // ---- token helpers ----
  peek(offset = 0) {
    return this.tokens[Math.min(this.position + offset, this.tokens.length - 1)];
  }
  next() {
    return this.tokens[this.position++];
  }
  is(value, offset = 0) {
    const token = this.peek(offset);
    return (token.type === 'symbol' || token.type === 'name') && token.value === value;
  }
  accept(value) {
    if (this.is(value)) {
      return this.next();
    }
    return undefined;
  }
  expect(value) {
    const token = this.accept(value);
    if (!token) {
      throw new SyntaxError(`Expected "${value}" but found "${this.peek().value || this.peek().type}"`, this.peek().line);
    }
    return token;
  }
  expectName() {
    const token = this.next();
    if (token.type !== 'name') {
      throw new SyntaxError(`Expected a name but found "${token.value}"`, token.line);
    }
    return token.value;
  }
  skipSeparators() {
    while (this.peek().type === 'newline' || this.is(';')) {
      this.next();
    }
  }
  endStatement() {
    if (this.accept(';') || this.peek().type === 'newline') {
      this.skipSeparators();
      return;
    }
    if (this.is('}') || this.peek().type === 'end' || this.peek().type === 'dedent' || this.is('end')) {
      return;
    }
    throw new SyntaxError(`Unexpected "${this.peek().value}" after statement`, this.peek().line);
  }

  // ---- program structure ----
  program() {
    const items = this.items(() => this.peek().type === 'end');
    return node('SourceProgram', { language: this.syntax.id, items });
  }

  items(done) {
    const items = [];
    this.skipSeparators();
    while (!done()) {
      items.push(this.item());
      this.skipSeparators();
    }
    return items;
  }

  item() {
    const token = this.peek();
    if (token.type === 'comment') {
      this.next();
      return node('Comment', { text: token.value });
    }
    if (token.type === 'directive') {
      this.next();
      return node('Import', { text: token.value });
    }
    if (['import', 'using', 'package', 'use', 'require'].includes(token.value) && token.type === 'name' && !this.is('(', 1)) {
      return this.importStatement();
    }
    if (this.isNamespaceOrClass()) {
      return this.classDefinition();
    }
    if (this.isFunctionStart()) {
      return this.functionDefinition();
    }
    return this.statement();
  }

  importStatement() {
    const parts = [];
    const line = this.peek().line;
    while (this.peek().type !== 'newline' && !this.is(';') && this.peek().type !== 'end' && this.peek().line === line) {
      const token = this.next();
      parts.push(token.type === 'text' ? `"${token.value}"` : token.value);
    }
    this.endStatement();
    return node('Import', { text: parts.join(' ').replace(/ \. /g, '.').replace(/ :: /g, '::') });
  }

  isNamespaceOrClass() {
    let offset = 0;
    while (modifiers.has(this.peek(offset).value)) {
      offset += 1;
    }
    return ['class', 'namespace', 'object'].includes(this.peek(offset).value) && this.peek(offset).type === 'name';
  }

  classDefinition() {
    while (modifiers.has(this.peek().value)) {
      this.next();
    }
    const kind = this.next().value;
    const title = this.expectName();
    this.expect('{');
    const items = this.items(() => this.is('}'));
    this.expect('}');
    return node('Class', { kind, name: title, items });
  }

  isFunctionStart() {
    if (this.syntax.functionKeyword) {
      let offset = 0;
      while (modifiers.has(this.peek(offset).value)) {
        offset += 1;
      }
      return this.is(this.syntax.functionKeyword, offset) && this.peek(offset + 1).type === 'name';
    }
    // Prefix-typed languages: [modifiers] [type] name ( ... ) {
    let offset = 0;
    while (this.peek(offset).type === 'name' || ['*', '::', '[', ']', '<', '>'].includes(this.peek(offset).value)) {
      offset += 1;
    }
    if (!this.is('(', offset) || offset === 0 || this.peek(offset - 1).type !== 'name') {
      return false;
    }
    let depth = 0;
    for (let index = offset; ; index += 1) {
      const token = this.peek(index);
      if (token.type === 'end') return false;
      if (token.value === '(') depth += 1;
      if (token.value === ')') {
        depth -= 1;
        if (depth === 0) {
          let after = index + 1;
          while (this.peek(after).type === 'newline') after += 1;
          return this.is('{', after);
        }
      }
    }
  }

  functionDefinition() {
    while (modifiers.has(this.peek().value)) {
      this.next();
    }
    let returnType;
    let functionName;
    if (this.syntax.functionKeyword) {
      this.expect(this.syntax.functionKeyword);
      functionName = this.expectName();
    } else {
      const words = [];
      while (!this.is('(')) {
        words.push(this.next().value);
      }
      functionName = words.pop();
      returnType = words.length ? sourceType(words.join(' ')) : undefined;
    }
    const parameters = this.peek().type === 'newline' && this.syntax.id === 'ruby' ? [] : this.parameterList();
    if (this.accept('->') || (this.syntax.returnArrow === ':' && this.accept(':'))) {
      returnType = this.typeExpression();
    } else if (this.syntax.typed === 'suffix' && !this.is('{')) {
      returnType = this.typeExpression();
    }
    const body = this.block();
    return node('Function', { name: functionName, parameters, returnType, body });
  }

  parameterList() {
    this.expect('(');
    const parameters = [];
    const pendingNames = [];
    while (!this.is(')')) {
      if (this.syntax.typed === 'prefix') {
        const words = [];
        while (!this.is(',') && !this.is(')')) {
          words.push(this.next().value);
        }
        const parameterName = words.pop();
        parameters.push({ name: parameterName, type: sourceType(words.join(' ')) });
      } else if (this.syntax.typed === 'suffix') {
        pendingNames.push(this.expectName());
        if (!this.is(',') && !this.is(')')) {
          const type = this.typeExpression();
          for (const pending of pendingNames.splice(0)) {
            parameters.push({ name: pending, type });
          }
        }
      } else {
        if (this.syntax.id === 'swift' && this.peek(1).type === 'name') {
          this.next(); // argument label such as "_"
        }
        const parameterName = this.expectName();
        const type = this.accept(':') ? this.typeExpression() : undefined;
        parameters.push({ name: parameterName, type });
      }
      if (!this.accept(',')) {
        break;
      }
    }
    this.expect(')');
    return parameters;
  }

  typeExpression() {
    const words = [];
    let depth = 0;
    while (true) {
      const token = this.peek();
      if (token.value === '<') depth += 1;
      if (token.value === '>') depth -= 1;
      if (depth === 0 && (token.type === 'newline' || ['{', '=', ',', ')', ';'].includes(token.value))) break;
      if (token.type === 'end') break;
      words.push(this.next().value);
    }
    return sourceType(words.join(' '));
  }

  // ---- blocks ----
  block() {
    if (this.syntax.blocks === 'braces') {
      while (this.peek().type === 'newline') this.next();
      this.expect('{');
      const statements = this.items(() => this.is('}'));
      this.expect('}');
      return block(statements);
    }
    if (this.syntax.blocks === 'indentation') {
      this.expect(':');
      this.skipComments();
      if (this.peek().type !== 'newline') {
        throw new SyntaxError('Expected a new line after ":"', this.peek().line);
      }
      this.skipSeparators();
      if (this.next().type !== 'indent') {
        throw new SyntaxError('Expected an indented block', this.peek().line);
      }
      const statements = this.items(() => this.peek().type === 'dedent' || this.peek().type === 'end');
      this.next();
      return block(statements);
    }
    // Keyword-delimited blocks (Ruby, Lua) stop at end / else / elsif.
    this.accept('then');
    this.accept('do');
    const statements = this.items(() => ['end', 'else', 'elsif', 'elseif'].some((word) => this.is(word)));
    return block(statements);
  }

  skipComments() {
    while (this.peek().type === 'comment') this.next();
  }

  closeKeywordBlock() {
    if (this.syntax.blocks === 'end') {
      this.expect('end');
    }
  }

  // ---- statements ----
  statement() {
    const token = this.peek();
    const word = token.type === 'name' ? token.value : undefined;
    switch (word) {
      case 'if':
        return this.ifStatement();
      case 'while':
        return this.whileStatement();
      case 'for':
        return this.forStatement();
      case 'return': {
        this.next();
        const value = this.isStatementEnd() ? undefined : this.expression();
        this.endStatement();
        return node('Return', { value });
      }
      case 'echo':
        return this.echoStatement();
      default:
        break;
    }
    if (word && (this.syntax.declarations.includes(word) || (this.syntax.id === 'go' && word === 'var'))) {
      return this.declaration();
    }
    if (this.syntax.typed === 'prefix' && this.isTypedDeclaration()) {
      return this.typedDeclaration();
    }
    return this.simpleStatement();
  }

  isStatementEnd() {
    const token = this.peek();
    return token.type === 'newline' || token.type === 'end' || this.is(';') || this.is('}') || token.type === 'dedent';
  }

  isTypedDeclaration() {
    let offset = 0;
    while (this.peek(offset).type === 'name' || ['*', '::', '[', ']'].includes(this.peek(offset).value)) {
      offset += 1;
    }
    return offset >= 2 && this.peek(offset - 1).type === 'name' && (this.is('=', offset) || this.is(';', offset)) && (typeWords.has(this.peek().value) || this.peek(1).type === 'name');
  }

  typedDeclaration() {
    const words = [];
    while (!this.is('=') && !this.is(';')) {
      words.push(this.next().value);
    }
    const variable = words.pop();
    const type = sourceType(words.join(' '));
    const value = this.accept('=') ? this.expression() : undefined;
    this.endStatement();
    return node('Declaration', { name: variable, type, value, mutable: !words.includes('const') });
  }

  declaration() {
    const keyword = this.next().value;
    const mutable = this.accept('mut') ? true : !['const', 'val', 'let'].includes(keyword) || this.syntax.id === 'javascript' || this.syntax.id === 'typescript';
    const variable = this.expectName();
    let type;
    if (this.accept(':')) {
      type = this.typeExpression();
    } else if (this.syntax.typed === 'suffix' && !this.is('=')) {
      type = this.typeExpression();
    }
    const value = this.accept('=') ? this.expression() : undefined;
    this.endStatement();
    return node('Declaration', { name: variable, type, value, mutable: keyword === 'const' ? false : mutable });
  }

  simpleStatement() {
    if (this.peek().type === 'name' && this.is(':=', 1)) {
      const variable = this.next().value;
      this.next();
      const value = this.expression();
      this.endStatement();
      return node('Declaration', { name: variable, value, mutable: true });
    }
    if ((this.is('++') || this.is('--')) && this.peek(1).type === 'name') {
      const operator = this.next().value === '++' ? '+=' : '-=';
      const variable = this.next().value;
      this.endStatement();
      return node('Assignment', { name: variable, operator, value: number(1) });
    }
    if (this.peek().type === 'name' && ['=', '+=', '-=', '*=', '/=', '%=', '++', '--'].some((symbol) => this.is(symbol, 1))) {
      const variable = this.next().value;
      const operator = this.next().value;
      const value = operator === '++' || operator === '--' ? number(1) : this.expression();
      this.endStatement();
      return node('Assignment', { name: variable, operator: operator === '++' ? '+=' : operator === '--' ? '-=' : operator, value });
    }
    if (this.isCommandCall()) {
      const callee = this.next().value;
      const values = [this.expression()];
      while (this.accept(',')) values.push(this.expression());
      this.endStatement();
      return node('Evaluate', { expression: node('Call', { callee, arguments: values }) });
    }
    const expression = this.expression();
    const terminated = this.is(';');
    this.endStatement();
    if (this.syntax.id === 'rust' && !terminated && this.is('}')) {
      return node('Return', { value: expression, implicit: true });
    }
    return node('Evaluate', { expression });
  }

  // Ruby allows calls without parentheses, such as `puts "Hello"`.
  isCommandCall() {
    if (this.syntax.id !== 'ruby' || this.peek().type !== 'name') return false;
    const following = this.peek(1);
    return ['text', 'number', 'name'].includes(following.type) && following.line === this.peek().line && !['do', 'then', 'if'].includes(following.value);
  }

  echoStatement() {
    this.next();
    const values = [this.expression()];
    while (this.accept(',')) values.push(this.expression());
    this.endStatement();
    return node('Evaluate', { expression: node('Call', { callee: 'echo', arguments: values }) });
  }

  condition() {
    const value = this.expression();
    if (this.syntax.blocks === 'end') {
      this.accept('then');
      this.accept('do');
    }
    return value;
  }

  ifStatement() {
    this.next();
    const condition = this.condition();
    const then = this.block();
    let otherwise;
    this.skipBlankLinesBeforeElse();
    const elseIf = this.syntax.id === 'python' ? 'elif' : this.syntax.elseIf;
    if (elseIf && this.is(elseIf)) {
      otherwise = this.ifStatementAfterKeyword();
      return node('If', { condition, then, otherwise });
    }
    if (this.accept('else')) {
      if (this.is('if')) {
        otherwise = this.ifStatement();
        return node('If', { condition, then, otherwise });
      }
      otherwise = this.block();
    }
    this.closeKeywordBlock();
    return node('If', { condition, then, otherwise });
  }

  ifStatementAfterKeyword() {
    return this.ifStatement();
  }

  skipBlankLinesBeforeElse() {
    let offset = 0;
    while (this.peek(offset).type === 'newline') offset += 1;
    if (['else', 'elif', 'elsif', 'elseif'].some((word) => this.is(word, offset))) {
      this.position += offset;
    }
  }

  whileStatement() {
    this.next();
    const condition = this.condition();
    const body = this.block();
    this.closeKeywordBlock();
    return node('While', { condition, body });
  }

  forStatement() {
    this.next();
    const parenthesized = this.syntax.id !== 'go' && this.is('(') && (this.syntax.id === 'kotlin' || this.syntax.blocks === 'braces');
    if (parenthesized) this.expect('(');
    // C family: for (init; condition; update)
    const isClassic = this.tokensUntilBlock().some((token) => token.value === ';');
    if (isClassic) {
      const initial = this.statement();
      const condition = this.expression();
      this.expect(';');
      const update = this.forUpdate();
      if (parenthesized) this.expect(')');
      const body = this.block();
      return countingLoop(initial, condition, update, body);
    }
    if (this.syntax.id === 'go' && !this.is('range', 1) && !this.is(':=', 1)) {
      const condition = this.expression();
      return node('While', { condition, body: this.block() });
    }
    const variable = this.expectName();
    if (this.syntax.id === 'lua') {
      this.expect('=');
      const start = this.expression();
      this.expect(',');
      const last = this.expression();
      const body = this.block();
      this.closeKeywordBlock();
      return node('CountingLoop', { variable, start, end: add(last, number(1)), body });
    }
    this.expect('in');
    const range = this.rangeExpression();
    if (parenthesized) this.expect(')');
    const body = this.block();
    this.closeKeywordBlock();
    return node('CountingLoop', { variable, ...range, body });
  }

  tokensUntilBlock() {
    const tokens = [];
    for (let offset = 0; ; offset += 1) {
      const token = this.peek(offset);
      if (token.type === 'end' || token.value === '{' || token.type === 'newline') return tokens;
      tokens.push(token);
    }
  }

  forUpdate() {
    const variable = this.expectName();
    const operator = this.next().value;
    if (operator === '++') return { name: variable, step: 1 };
    if (operator === '+=') return { name: variable, step: this.expression().value };
    throw new SyntaxError('Only counting loops with increasing steps are supported', this.peek().line);
  }

  rangeExpression() {
    if (this.is('range')) {
      this.next();
      this.expect('(');
      const first = this.expression();
      const second = this.accept(',') ? this.expression() : undefined;
      this.expect(')');
      return second ? { start: first, end: second } : { start: number(0), end: first };
    }
    const start = this.additive();
    const operator = this.next().value;
    const last = this.additive();
    switch (operator) {
      case 'until':
      case '..<':
        return { start, end: last };
      case '...':
        return this.syntax.id === 'ruby' ? { start, end: last } : { start, end: add(last, number(1)) };
      case '..':
        return this.syntax.id === 'rust' ? { start, end: last } : { start, end: add(last, number(1)) };
      case '..=':
        return { start, end: add(last, number(1)) };
      default:
        throw new SyntaxError(`Unsupported range operator "${operator}"`, this.peek().line);
    }
  }

  // ---- expressions ----
  expression() {
    return this.binary(0);
  }

  additive() {
    return this.binary(4);
  }

  binary(level) {
    if (level === binaryLevels.length) {
      return this.unary();
    }
    let left = this.binary(level + 1);
    while (true) {
      const token = this.peek();
      const operator = Object.entries(binaryLevels[level]).find(([, surfaces]) => surfaces.includes(token.value) && (token.type === 'symbol' || token.type === 'name'));
      if (!operator) {
        // C++ stream output: std::cout << a << b
        if (level === 4 && token.value === '<<') {
          this.next();
          const right = this.binary(level + 1);
          left = node('Binary', { operator: 'stream', left, right });
          continue;
        }
        return left;
      }
      if (token.value === '..' && this.syntax.id !== 'lua') return left;
      this.next();
      const right = this.binary(level + 1);
      left = node('Binary', { operator: operator[0], left, right });
    }
  }

  unary() {
    if (this.accept('-')) {
      const operand = this.unary();
      return operand.kind === 'Number' ? number(-operand.value) : node('Unary', { operator: 'negate', operand });
    }
    if (this.accept('!') || this.accept('not')) {
      return node('Unary', { operator: 'not', operand: this.unary() });
    }
    return this.postfix();
  }

  postfix() {
    let expression = this.primary();
    while (true) {
      if ((this.is('.') || this.is('::')) && this.peek(1).type === 'name') {
        const separator = this.next().value;
        expression = name(`${calleeName(expression)}${separator}${this.next().value}`);
        continue;
      }
      if (this.is('(')) {
        this.next();
        const values = [];
        while (!this.is(')')) {
          if (this.peek().type === 'name' && this.is('=', 1)) {
            const label = this.next().value;
            this.next();
            values.push(node('NamedArgument', { name: label, value: this.expression() }));
          } else {
            values.push(this.expression());
          }
          if (!this.accept(',')) break;
        }
        this.expect(')');
        expression = node('Call', { callee: calleeName(expression), arguments: values });
        continue;
      }
      return expression;
    }
  }

  primary() {
    const token = this.next();
    switch (token.type) {
      case 'number':
        return number(Number(token.value));
      case 'text':
        return this.textLiteral(token);
      case 'name':
        if (['true', 'True'].includes(token.value)) return node('Boolean', { value: true });
        if (['false', 'False'].includes(token.value)) return node('Boolean', { value: false });
        return name(token.value);
      case 'symbol':
        if (token.value === '(') {
          const inner = this.expression();
          this.expect(')');
          return inner;
        }
        break;
      default:
        break;
    }
    throw new SyntaxError(`Unexpected "${token.value || token.type}" in expression`, token.line);
  }

  textLiteral(token) {
    const style = token.quote === "'" && ['php', 'ruby'].includes(this.syntax.id) ? 'plain' : token.style;
    const pattern = {
      braces: /\{([^{}]+)\}/g,
      'dollar-braces': /\$\{([^{}]+)\}/g,
      'hash-braces': /#\{([^{}]+)\}/g,
      dollar: /\$\{([^{}]+)\}|\{\$([^{}]+)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g,
      'backslash-parentheses': /\\\(([^()]+)\)/g,
    }[style];
    if (!pattern) {
      return text(token.quote === "'" && this.syntax.id === 'php' ? token.value : decodeEscapes(token.value));
    }
    const parts = [];
    let last = 0;
    for (const match of token.value.matchAll(pattern)) {
      if (match.index > last) parts.push(text(decodeEscapes(token.value.slice(last, match.index))));
      const inner = match[1] ?? match[2] ?? match[3];
      const innerSyntax = { ...this.syntax, variableSigil: '$' };
      parts.push(new Parser(tokenize(inner, innerSyntax), innerSyntax).expression());
      last = match.index + match[0].length;
    }
    if (last < token.value.length) parts.push(text(decodeEscapes(token.value.slice(last))));
    if (parts.length === 1 && parts[0].kind === 'Text') return parts[0];
    return node('Interpolation', { parts });
  }
}

function calleeName(expression) {
  if (expression.kind !== 'Name') {
    throw new SyntaxError('Only named functions can be called', 0);
  }
  return expression.name;
}

function countingLoop(initial, condition, update, body) {
  const variable = initial.name;
  const ok = (initial.kind === 'Declaration' || initial.kind === 'Assignment') && condition.kind === 'Binary' && condition.left.kind === 'Name' && condition.left.name === variable && update.name === variable && update.step === 1;
  if (!ok || !['less', 'lessOrEqual'].includes(condition.operator)) {
    throw new SyntaxError('Only counting loops of the form for (i = a; i < b; i++) are supported', 0);
  }
  const end = condition.operator === 'less' ? condition.right : add(condition.right, number(1));
  return node('CountingLoop', { variable, start: initial.value, end, body });
}

// Map a source type spelling to a meta type.
export function sourceType(spelling) {
  const words = spelling.replace(/\b(const|static|unsigned|signed|mut)\b/g, '').replace(/\s+/g, ' ').trim();
  if (/^(int|long|short|i8|i16|i32|i64|isize|u8|u16|u32|u64|usize|Int|Long|number|integer)$/.test(words)) return 'integer';
  if (/^(char ?\*|std ?:: ?string|string|String|& ?str|&'static str)$/.test(words)) return 'text';
  if (/^(bool|boolean|Bool|Boolean)$/.test(words)) return 'boolean';
  if (/^(void|\(\)|Unit|Void)$/.test(words)) return 'nothing';
  if (words === '' || words === 'var' || words === 'auto') return undefined;
  return `source:${words}`;
}
