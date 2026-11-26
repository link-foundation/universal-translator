// Recursive-descent parser driven by the language descriptions in
// languages.js. It produces the meta tree described in meta.js, keeping the
// surface concepts (calls, imports, classes) that later rule layers
// interpret. The parser never decides what a program means.

import { decodeEscapes, SyntaxError, tokenize } from './lexer.js';
import { block, name, node, number, text } from '../meta/tree.js';
import { dialects } from './dialects/index.js';
import { withArrays } from './array-parser.js';
import { stepOperators, withLoops } from './loop-parser.js';
import { withFunctionForms } from './function-forms.js';
import { slashOperator } from './numbers.js';

const binaryLevels = [
  { or: ['||', 'or'] },
  { and: ['&&', 'and'] },
  { equal: ['==', '==='], notEqual: ['!=', '!==', '~='] },
  { less: ['<'], lessOrEqual: ['<='], greater: ['>'], greaterOrEqual: ['>='] },
  { add: ['+', '..'], subtract: ['-'] },
  { multiply: ['*'], divide: ['/', '//'], remainder: ['%'] },
];

const typeWords = new Set([
  'int',
  'long',
  'short',
  'char',
  'void',
  'bool',
  'boolean',
  'double',
  'float',
  'string',
  'String',
  'var',
  'auto',
  'const',
  'unsigned',
  'signed',
  'std',
]);
// The languages whose arrow functions are read as named functions.
const arrowLanguages = new Set(['javascript', 'typescript']);
const modifiers = new Set([
  'public',
  'private',
  'protected',
  'static',
  'internal',
  'final',
  'export',
  'inline',
  'async',
  'local',
]);

export function parseProgram(source, syntax) {
  const LanguageParser = parserFor(syntax);
  return new LanguageParser(tokenize(source, syntax), syntax).program();
}

// Languages whose statements follow a grammar of their own (Fortran, Pascal,
// Ada, Visual Basic, Bash, MATLAB, Zig, Lean, Rocq) extend the shared parser in
// dialects/; they keep its expressions and token helpers.
const dialectParsers = new Map();
function parserFor(syntax) {
  const extend = dialects[syntax.id]?.parser;
  if (!extend) {
    return Parser;
  }
  if (!dialectParsers.has(syntax.id)) {
    dialectParsers.set(syntax.id, extend(Parser));
  }
  return dialectParsers.get(syntax.id);
}

const controlWords = new Set([
  'if',
  'else',
  'while',
  'for',
  'foreach',
  'switch',
  'return',
  'do',
  'catch',
]);

class BaseParser {
  constructor(tokens, syntax) {
    this.tokens = tokens;
    this.position = 0;
    this.syntax = syntax;
    // Word operators such as Nim's mod and div, or Pascal's <>, join the
    // shared symbols of their level.
    const { remainder, integerDivide, and, or, equal, notEqual } =
      syntax.operators;
    const extra = {
      remainder,
      divide: integerDivide,
      and,
      or,
      equal,
      notEqual,
    };
    this.levels = binaryLevels.map((level) =>
      Object.fromEntries(
        Object.entries(level).map(([operator, shared]) => {
          // Fortran joins text with //, which divides elsewhere.
          const surfaces = shared.filter(
            (surface) => surface !== syntax.operators.concatenate
          );
          return [
            operator,
            extra[operator] && !surfaces.includes(extra[operator])
              ? [...surfaces, extra[operator]]
              : surfaces,
          ];
        })
      )
    );
  }

  // ---- token helpers ----
  peek(offset = 0) {
    return this.tokens[
      Math.min(this.position + offset, this.tokens.length - 1)
    ];
  }
  // Reading past the end is a syntax error, so no loop runs on forever.
  next() {
    if (this.position >= this.tokens.length) {
      throw new SyntaxError('Unexpected end of program', this.peek().line);
    }
    return this.tokens[this.position++];
  }
  is(value, offset = 0) {
    const token = this.peek(offset);
    if (token.type === 'name' && this.syntax.caseInsensitive) {
      return token.value.toLowerCase() === String(value).toLowerCase();
    }
    return (
      (token.type === 'symbol' || token.type === 'name') &&
      token.value === value
    );
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
      throw new SyntaxError(
        `Expected "${value}" but found "${this.peek().value || this.peek().type}"`,
        this.peek().line
      );
    }
    return token;
  }
  expectName() {
    const token = this.next();
    if (token.type !== 'name') {
      throw new SyntaxError(
        `Expected a name but found "${token.value}"`,
        token.line
      );
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
    if (
      this.peek().trailing ||
      this.is('}') ||
      this.peek().type === 'end' ||
      this.peek().type === 'dedent' ||
      this.is('end')
    ) {
      return;
    }
    throw new SyntaxError(
      `Unexpected "${this.peek().value}" after statement`,
      this.peek().line
    );
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
      // Concrete syntax: empty lines between two items are kept.
      const blank = this.blankLinesBefore();
      if (blank && items.length) {
        items.push(node('Blank', { lines: blank }));
      }
      // A C-style loop that is not a counting loop becomes several statements.
      const item = this.item();
      items.push(...(item.kind === 'Statements' ? item.statements : [item]));
      this.skipSeparators();
    }
    return items;
  }

  // Empty lines right before the current token.
  blankLinesBefore() {
    const skipped = (token) =>
      ['indent', 'dedent', ';'].includes(token.value) ||
      ['indent', 'dedent'].includes(token.type);
    let index = this.position - 1;
    while (index >= 0 && skipped(this.tokens[index])) {
      index -= 1;
    }
    const token = this.tokens[index];
    return token?.type === 'newline' ? (token.blank ?? 0) : 0;
  }

  item() {
    const token = this.peek();
    if (token.type === 'comment') {
      this.next();
      return node('Comment', {
        text: token.value,
        ...(token.trailing ? { trailing: token.trailing } : {}),
        ...(token.block ? { block: true } : {}),
      });
    }
    if (token.type === 'directive') {
      this.next();
      return node('Import', { text: token.value });
    }
    if (this.isImportStart(token)) {
      return this.importStatement();
    }
    if (this.isNamespaceOrClass()) {
      return this.classDefinition();
    }
    const announcement = this.announcementLength();
    if (announcement) {
      // `int male(int index);` only announces a function defined later.
      this.position += announcement;
      return node('Statements', { statements: [] });
    }
    if (this.isFunctionStart()) {
      return this.functionDefinition();
    }
    if (this.isArrowFunctionStart()) {
      return this.arrowFunctionDefinition();
    }
    if (this.isStaticMethodStart()) {
      return this.staticMethodDefinition();
    }
    return this.statement();
  }

  // Import lines: `import`, `using`, `package`, `use`, `require`,
  // `require_once`, Rust `mod name;` and Python `from module import a`.
  isImportStart(token) {
    if (token.type !== 'name' || this.is('(', 1)) {
      return false;
    }
    if (token.value === 'from') {
      return this.peek(2).value === 'import';
    }
    if (token.value === 'mod') {
      return this.peek(1).type === 'name' && this.is(';', 2);
    }
    return [
      'import',
      'using',
      'package',
      'use',
      'require',
      'require_once',
      'require_relative',
    ].includes(token.value);
  }

  importStatement() {
    const parts = [];
    const line = this.peek().line;
    while (
      this.peek().type !== 'newline' &&
      !this.is(';') &&
      this.peek().type !== 'end' &&
      this.peek().line === line
    ) {
      const token = this.next();
      parts.push(token.type === 'text' ? `"${token.value}"` : token.value);
    }
    this.endStatement();
    return node('Import', {
      text: parts.join(' ').replace(/ \. /g, '.').replace(/ :: /g, '::'),
    });
  }

  isNamespaceOrClass() {
    let offset = 0;
    while (modifiers.has(this.peek(offset).value)) {
      offset += 1;
    }
    return (
      ['class', 'namespace', 'object'].includes(this.peek(offset).value) &&
      this.peek(offset).type === 'name'
    );
  }

  classDefinition() {
    while (modifiers.has(this.peek().value)) {
      this.next();
    }
    const kind = this.next().value;
    const title = this.expectName();
    // Scala: the body of `object Hello extends App { ... }` is the program.
    if (this.syntax.id === 'scala' && this.is('extends') && this.is('App', 1)) {
      this.position += 2;
    }
    while (this.peek().type === 'newline') {
      this.next();
    }
    this.expect('{');
    this.classDepth = (this.classDepth ?? 0) + 1;
    const items = this.items(() => this.is('}'));
    this.classDepth -= 1;
    this.expect('}');
    return node('Class', { form: kind, name: title, items });
  }

  isFunctionStart() {
    if (this.syntax.functionForm === 'assigned') {
      return (
        this.peek().type === 'name' &&
        this.is(this.syntax.assignment, 1) &&
        this.is('function', 2)
      );
    }
    return this.syntax.functionKeyword
      ? this.isKeywordFunctionStart()
      : this.isPrefixFunctionStart();
  }

  // JavaScript and TypeScript name a function by declaring a constant:
  // `const name = (first, second) => ...` or `const name = single => ...`.
  isArrowFunctionStart() {
    if (
      !arrowLanguages.has(this.syntax.id) ||
      !this.syntax.declarations.includes(this.peek().value) ||
      this.peek(1).type !== 'name' ||
      !this.is('=', 2)
    ) {
      return false;
    }
    if (this.peek(3).type === 'name') {
      return this.is('=>', 4);
    }
    const closing = this.closingParenthesis(3);
    if (closing === undefined) {
      return false;
    }
    // A TypeScript return type may follow the parameters.
    let offset = closing + 1;
    if (this.is(':', offset)) {
      while (
        this.peek(offset).type !== 'end' &&
        this.peek(offset).type !== 'newline' &&
        !this.is('=>', offset)
      ) {
        offset += 1;
      }
    }
    return this.is('=>', offset);
  }

  // A JavaScript or TypeScript class holds functions as static methods:
  // `static name(first, second) { ... }`. Methods of objects need objects in
  // the meta language and are not read.
  isStaticMethodStart() {
    if (!arrowLanguages.has(this.syntax.id) || !this.classDepth) {
      return false;
    }
    let offset = 0;
    while (modifiers.has(this.peek(offset).value)) {
      offset += 1;
    }
    return (
      offset > 0 &&
      this.peek(offset - 1).value === 'static' &&
      this.peek(offset).type === 'name' &&
      this.is('(', offset + 1)
    );
  }

  staticMethodDefinition() {
    while (modifiers.has(this.peek().value)) {
      this.next();
    }
    const functionName = this.expectName();
    const parameters = this.parameterList();
    const returnType = this.accept(':') ? this.typeExpression() : undefined;
    return node('Function', {
      name: functionName,
      parameters,
      returnType,
      body: this.block(),
    });
  }

  // The arrow function as a function of its own: an expression body
  // returns its value.
  arrowFunctionDefinition() {
    this.next();
    const functionName = this.expectName();
    this.expect('=');
    const parameters = this.is('(')
      ? this.parameterList()
      : [{ name: this.expectName(), type: undefined }];
    const returnType = this.accept(':') ? this.typeExpression() : undefined;
    this.expect('=>');
    if (this.is('{')) {
      const body = this.block();
      this.accept(';');
      return node('Function', {
        name: functionName,
        parameters,
        returnType,
        body,
      });
    }
    const value = this.expression();
    this.endStatement();
    return node('Function', {
      name: functionName,
      parameters,
      returnType,
      body: block([node('Return', { value })]),
    });
  }

  // [modifiers] function-keyword name
  isKeywordFunctionStart() {
    let offset = 0;
    while (modifiers.has(this.peek(offset).value)) {
      offset += 1;
    }
    return (
      this.is(this.syntax.functionKeyword, offset) &&
      this.peek(offset + 1).type === 'name'
    );
  }

  // Prefix-typed languages: [modifiers] [type] name ( ... ) {
  isPrefixFunctionStart() {
    const offset = this.prefixHeadLength();
    return (
      offset > 0 &&
      this.is('(', offset) &&
      this.peek(offset - 1).type === 'name' &&
      this.isBlockAfterParentheses(offset)
    );
  }

  // The words and type symbols before a function's parameter list.
  prefixHeadLength() {
    if (controlWords.has(this.peek().value)) {
      return 0;
    }
    let offset = 0;
    while (
      this.peek(offset).type === 'name' ||
      ['*', '::', '[', ']', '<', '>'].includes(this.peek(offset).value)
    ) {
      offset += 1;
    }
    return offset;
  }

  // The number of tokens that announce a function defined later, or 0:
  // `int male(int index);` (prototype), `proc male(index: int): int`
  // (heading) or `local male` followed later by `function male` (local).
  announcementLength() {
    switch (this.syntax.forwardDeclarations) {
      case 'prototype':
        return this.prototypeLength();
      case 'heading':
        return this.headingLength();
      case 'local':
        return this.localAnnouncementLength();
      default:
        return 0;
    }
  }

  prototypeLength() {
    const offset = this.prefixHeadLength();
    const end = offset > 1 && this.closingParenthesis(offset);
    return end && this.peek(offset - 1).type === 'name' && this.is(';', end + 1)
      ? end + 2
      : 0;
  }

  // A function heading whose line ends before the body marker.
  headingLength() {
    if (!this.isKeywordFunctionStart()) {
      return 0;
    }
    let index = 0;
    while (!['newline', 'end'].includes(this.peek(index).type)) {
      if (this.is(this.syntax.bodyAfter, index)) {
        return 0;
      }
      index += 1;
    }
    return index;
  }

  localAnnouncementLength() {
    const announced = this.peek(1);
    if (
      !this.is('local') ||
      announced.type !== 'name' ||
      !['newline', 'end'].includes(this.peek(2).type)
    ) {
      return 0;
    }
    const defined = this.tokens.some(
      (token, index) =>
        token.value === this.syntax.functionKeyword &&
        this.tokens[index + 1]?.value === announced.value
    );
    return defined ? 2 : 0;
  }

  // Whether the parentheses opening at offset are followed by a { block.
  isBlockAfterParentheses(offset) {
    return this.is('{', this.afterParentheses(offset));
  }

  // The offset of the first token after the parentheses opening at offset,
  // past line ends.
  afterParentheses(offset) {
    let after = (this.closingParenthesis(offset) ?? offset) + 1;
    while (this.peek(after).type === 'newline') {
      after += 1;
    }
    return after;
  }

  // The offset of the ")" closing the parentheses opening at offset.
  closingParenthesis(offset) {
    if (!this.is('(', offset)) {
      return undefined;
    }
    let depth = 0;
    for (let index = offset; this.peek(index).type !== 'end'; index += 1) {
      const { value } = this.peek(index);
      depth += value === '(' ? 1 : value === ')' ? -1 : 0;
      if (depth === 0) {
        return index;
      }
    }
    return undefined;
  }

  // The name of a function, and the return type written before it.
  functionHead() {
    if (this.syntax.functionForm === 'assigned') {
      const functionName = this.expectName();
      this.expect(this.syntax.assignment);
      this.expect('function');
      return { functionName };
    }
    if (this.syntax.functionKeyword) {
      this.expect(this.syntax.functionKeyword);
      return { functionName: this.expectName() };
    }
    const words = [];
    while (!this.is('(')) {
      words.push(this.next().value);
    }
    const functionName = words.pop();
    return {
      functionName,
      returnType: words.length ? sourceType(words.join(' ')) : undefined,
    };
  }

  functionDefinition() {
    while (modifiers.has(this.peek().value)) {
      this.next();
    }
    const head = this.functionHead();
    const { functionName } = head;
    let { returnType } = head;
    // Ruby and Perl may leave out the parentheses of a parameter list.
    let parameters = this.is('(') ? this.parameterList() : [];
    if (
      this.accept('->') ||
      (this.syntax.returnArrow && this.accept(this.syntax.returnArrow))
    ) {
      returnType = this.typeExpression();
    } else if (this.syntax.typed === 'suffix' && !this.is('{')) {
      returnType = this.typeExpression();
    }
    // Scala: def name(...): Type = { ... }
    if (this.syntax.bodyAfter && this.syntax.blocks !== 'indentation') {
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
    return node('Function', {
      name: functionName,
      parameters,
      returnType,
      body,
    });
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
        parameters.push({
          name: parameterName,
          type: sourceType(words.join(' ')),
        });
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
      if (token.value === '<') {
        depth += 1;
      }
      if (token.value === '>') {
        depth -= 1;
      }
      if (
        depth === 0 &&
        (token.type === 'newline' ||
          ['{', '=', '=>', ',', ')', ';'].includes(token.value))
      ) {
        break;
      }
      if (token.type === 'end') {
        break;
      }
      words.push(this.next().value);
    }
    return sourceType(words.join(' '));
  }

  // ---- blocks ----
  block() {
    if (this.syntax.blocks === 'braces') {
      while (this.peek().type === 'newline') {
        this.next();
      }
      this.expect('{');
      const statements = this.items(() => this.is('}'));
      this.expect('}');
      return block(statements);
    }
    if (this.syntax.blocks === 'indentation') {
      // Nim: proc name(...): Type = <indented body>
      if (!(this.syntax.bodyAfter && this.accept(this.syntax.bodyAfter))) {
        this.expect(':');
      }
      this.skipComments();
      if (this.peek().type !== 'newline') {
        throw new SyntaxError(
          'Expected a new line after ":"',
          this.peek().line
        );
      }
      this.skipSeparators();
      if (this.next().type !== 'indent') {
        throw new SyntaxError('Expected an indented block', this.peek().line);
      }
      const statements = this.items(
        () => this.peek().type === 'dedent' || this.peek().type === 'end'
      );
      this.next();
      return block(statements);
    }
    // Keyword-delimited blocks (Ruby, Lua) stop at end / else / elsif.
    this.accept('then');
    this.accept('do');
    const statements = this.items(() => this.is('end') || startsElse(this));
    return block(statements);
  }

  skipComments() {
    while (this.peek().type === 'comment') {
      this.next();
    }
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
    const keywords = {
      if: () => this.ifStatement(),
      while: () => this.whileStatement(),
      for: () => this.forStatement(),
      return: () => this.returnStatement(),
      echo: () => this.echoStatement(),
    };
    if (word && Object.hasOwn(keywords, word)) {
      return keywords[word]();
    }
    if (word === 'foreach' && this.syntax.forEach?.startsWith('foreach')) {
      return this.foreachStatement();
    }
    if (this.syntax.id === 'ruby' && this.isRangeEach()) {
      return this.rangeEach();
    }
    if (word && this.syntax.declarations.includes(word)) {
      return this.declaration();
    }
    if (this.syntax.typed === 'prefix' && this.isTypedDeclaration()) {
      return this.typedDeclaration();
    }
    return this.simpleStatement();
  }

  returnStatement() {
    this.next();
    // R leaves a function without a value by calling `return(invisible())`
    // (or `return()`, which prints NULL at the top level).
    const empty = ['(', ')'];
    const invisible = ['(', 'invisible', '(', ')', ')'];
    const bare = [invisible, empty].find((tokens) =>
      tokens.every((value, offset) => this.peek(offset).value === value)
    );
    if (bare) {
      for (let index = 0; index < bare.length; index += 1) {
        this.next();
      }
      this.endStatement();
      return node('Return', { value: undefined });
    }
    const value = this.isStatementEnd() ? undefined : this.expression();
    this.endStatement();
    return node('Return', { value });
  }

  isStatementEnd() {
    const token = this.peek();
    return (
      token.type === 'newline' ||
      token.type === 'end' ||
      this.is(';') ||
      this.is('}') ||
      token.type === 'dedent'
    );
  }

  isTypedDeclaration() {
    let offset = 0;
    while (
      this.peek(offset).type === 'name' ||
      ['*', '::', '[', ']', '<', '>'].includes(this.peek(offset).value)
    ) {
      offset += 1;
    }
    return (
      offset >= 2 &&
      this.peek(offset - 1).type === 'name' &&
      (this.is('=', offset) || this.is(';', offset)) &&
      (typeWords.has(this.peek().value) ||
        this.peek(1).type === 'name' ||
        this.is('<', 1))
    );
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
    return node('Declaration', {
      name: variable,
      type,
      value,
      mutable: !words.includes('const'),
    });
  }

  declaration() {
    if (this.syntax.parameters === 'unpacked' && this.is('(', 1)) {
      return this.unpackedParameters();
    }
    const keyword = this.next().value;
    const mutable = this.accept('mut')
      ? true
      : !['const', 'val', 'let'].includes(keyword) ||
        this.syntax.id === 'javascript' ||
        this.syntax.id === 'typescript';
    const variable = this.expectName();
    let type;
    if (this.accept(':')) {
      type = this.typeExpression();
    } else if (this.syntax.typed === 'suffix' && !this.is('=')) {
      type = this.typeExpression();
    }
    const value = this.accept('=') ? this.expression() : undefined;
    this.endStatement();
    return node('Declaration', {
      name: variable,
      type,
      value,
      mutable: keyword === 'const' ? false : mutable,
    });
  }

  // Perl passes arguments in @_; a function names them by unpacking it.
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

  simpleStatement() {
    if (this.peek().type === 'name' && this.is(':=', 1)) {
      return this.shortDeclaration();
    }
    if ((this.is('++') || this.is('--')) && this.peek(1).type === 'name') {
      return this.prefixStep();
    }
    if (
      this.peek().type === 'name' &&
      [...assignmentSymbols, this.syntax.assignment].some(
        (symbol) => symbol && this.is(symbol, 1)
      )
    ) {
      return this.assignment();
    }
    if (this.isCommandCall()) {
      return this.commandCall();
    }
    const expression = this.expression();
    const terminated = this.is(';');
    this.endStatement();
    if (this.syntax.id === 'rust' && !terminated && this.is('}')) {
      return node('Return', { value: expression, implicit: true });
    }
    return node('Evaluate', { expression });
  }

  // Go: name := value
  shortDeclaration() {
    const variable = this.next().value;
    this.next();
    const value = this.expression();
    this.endStatement();
    return node('Declaration', { name: variable, value, mutable: true });
  }

  // ++name and --name
  prefixStep() {
    const operator = stepOperators[this.next().value];
    const variable = this.next().value;
    this.endStatement();
    return node('Assignment', { name: variable, operator, value: number(1) });
  }

  // name = value, name += value, name++ ...
  assignment() {
    const variable = this.next().value;
    const written = this.next().value;
    const operator =
      stepOperators[written] ??
      (written === this.syntax.assignment ? '=' : written);
    const value = stepOperators[written] ? number(1) : this.expression();
    this.endStatement();
    return node('Assignment', { name: variable, operator, value });
  }

  // Calls written without parentheses: puts value, print value
  commandCall() {
    const callee = this.next().value;
    const ends = ['newline', 'end'].includes(this.peek().type);
    const values = ends ? [] : [this.expression()];
    while (!ends && this.accept(',')) {
      values.push(this.expression());
    }
    this.endStatement();
    return node('Evaluate', {
      expression: node('Call', { callee, arguments: values }),
    });
  }

  // Ruby allows calls without parentheses, such as `puts "Hello"`.
  isCommandCall() {
    const { commandCalls } = this.syntax;
    if (
      !commandCalls ||
      this.peek().type !== 'name' ||
      (Array.isArray(commandCalls) && !commandCalls.includes(this.peek().value))
    ) {
      return false;
    }
    const following = this.peek(1);
    // A bare `print` prints an empty line.
    if (
      Array.isArray(commandCalls) &&
      ['newline', 'end'].includes(following.type)
    ) {
      return true;
    }
    return (
      ['text', 'number', 'name'].includes(following.type) &&
      following.line === this.peek().line &&
      !['do', 'then', 'if'].includes(following.value)
    );
  }

  echoStatement() {
    this.next();
    const values = [this.expression()];
    while (this.accept(',')) {
      values.push(this.expression());
    }
    this.endStatement();
    return node('Evaluate', {
      expression: node('Call', { callee: 'echo', arguments: values }),
    });
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
    while (this.peek(offset).type === 'newline') {
      offset += 1;
    }
    if (startsElse(this, offset)) {
      this.position += offset;
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
    if (level === this.levels.length) {
      return this.unary();
    }
    let left = this.binary(level + 1);
    while (true) {
      const token = this.peek();
      const operator = Object.entries(this.levels[level]).find(
        ([, surfaces]) =>
          surfaces.includes(token.value) &&
          (token.type === 'symbol' || token.type === 'name')
      );
      if (!operator) {
        // C++ stream output: std::cout << a << b
        // PHP joins text with "."
        if (
          level === 4 &&
          token.type === 'symbol' &&
          token.value === this.syntax.operators.concatenate
        ) {
          this.next();
          left = node('Binary', {
            operator: 'concatenate',
            left,
            right: this.binary(level + 1),
          });
          continue;
        }
        if (level === 4 && token.value === '<<') {
          this.next();
          const right = this.binary(level + 1);
          left = node('Binary', { operator: 'stream', left, right });
          continue;
        }
        return left;
      }
      if (token.value === '..' && this.syntax.id !== 'lua') {
        return left;
      }
      this.next();
      if (token.value === '..') {
        // Lua's ".." joins text, numbers included. It binds looser than +
        // and -, to the right: "a" .. 1 + 2 is "a3".
        const right = this.binary(level);
        return node('Binary', { operator: 'concatenate', left, right });
      }
      const right = this.binary(level + 1);
      // `/` is true division or integer division, depending on the language.
      const meaning =
        token.value === '/' && operator[0] === 'divide'
          ? slashOperator(this.syntax)
          : operator[0];
      left = node('Binary', { operator: meaning, left, right });
    }
  }

  unary() {
    if (this.accept('-')) {
      const operand = this.unary();
      return operand.kind === 'Number'
        ? { ...operand, value: -operand.value }
        : node('Unary', { operator: 'negate', operand });
    }
    if (
      this.accept('!') ||
      this.accept('not') ||
      this.accept(this.syntax.operators.not)
    ) {
      return node('Unary', { operator: 'not', operand: this.unary() });
    }
    // ECMAScript 5 truncates with ~~(a / b), which reads as a call of "~~".
    if (this.is('~') && this.is('~', 1)) {
      this.position += 2;
      return node('Call', { callee: '~~', arguments: [this.unary()] });
    }
    return this.postfix();
  }

  postfix() {
    let expression = this.primary();
    while (true) {
      if (
        ((this.is('.') && this.syntax.operators.concatenate !== '.') ||
          this.is('::')) &&
        this.peek(1).type === 'name'
      ) {
        const separator = this.next().value;
        if (expression.kind !== 'Name') {
          expression = node('Method', {
            receiver: expression,
            name: this.next().value,
          });
          continue;
        }
        expression = name(
          `${calleeName(expression)}${separator}${this.next().value}`
        );
        continue;
      }
      if (this.is('(')) {
        const values = this.callArguments();
        expression =
          expression.kind === 'Method'
            ? node('Call', {
                callee: `.${expression.name}`,
                arguments: [expression.receiver, ...values],
              })
            : node('Call', {
                callee: calleeName(expression),
                arguments: values,
              });
        continue;
      }
      if (this.isTextCall(expression)) {
        expression = node('Call', {
          callee: calleeName(expression),
          arguments: [this.textLiteral(this.next())],
        });
        continue;
      }
      return expression;
    }
  }

  // The arguments of a call, from its "(" to its ")".
  callArguments() {
    this.expect('(');
    const values = [];
    while (!this.is(')')) {
      // Where "=" compares (Pascal, Ada, Visual Basic), `f(a = b)`
      // passes a truth value, not a named argument. Swift labels an
      // argument with ":", print(x, terminator: "").
      if (
        this.peek().type === 'name' &&
        ((this.syntax.operators.equal !== '=' && this.is('=', 1)) ||
          (this.syntax.id === 'swift' && this.is(':', 1)))
      ) {
        const label = this.next().value;
        this.next();
        values.push(
          node('NamedArgument', { name: label, value: this.expression() })
        );
      } else {
        values.push(this.expression());
      }
      if (!this.accept(',')) {
        break;
      }
    }
    this.expect(')');
    return values;
  }

  // Lua: a call with one text argument needs no parentheses, f "x".
  isTextCall(expression) {
    return (
      this.syntax.id === 'lua' &&
      expression.kind === 'Name' &&
      this.peek().type === 'text' &&
      this.peek().line === this.tokens[this.position - 1].line
    );
  }

  primary() {
    const token = this.next();
    switch (token.type) {
      case 'number':
        return numberLiteral(token.value);
      case 'text':
        return this.textLiteral(token);
      case 'name':
        for (const value of [true, false]) {
          const spellings = [String(value), this.syntax.words?.[value]];
          if (spellings.includes(token.value)) {
            return node('Boolean', { value });
          }
        }
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
    throw new SyntaxError(
      `Unexpected "${token.value || token.type}" in expression`,
      token.line
    );
  }

  textLiteral(token) {
    const style =
      token.quote === "'" && ['php', 'ruby'].includes(this.syntax.id)
        ? 'plain'
        : token.style;
    // Text read with doubled quotes (token.decoded) has no escapes.
    const decode = (raw) => (token.decoded ? raw : decodeEscapes(raw));
    if (style === 'plain' || !style) {
      return text(
        token.quote === "'" && this.syntax.id === 'php'
          ? token.value
          : decode(token.value)
      );
    }
    const parts = [];
    for (const piece of splitInterpolation(token.value, style)) {
      if (typeof piece === 'string') {
        parts.push(text(decode(piece)));
      } else {
        const innerSyntax = { ...this.syntax, variableSigil: '$' };
        parts.push(
          new this.constructor(
            tokenize(piece.code, innerSyntax),
            innerSyntax
          ).expression()
        );
      }
    }
    if (parts.length === 1 && parts[0].kind === 'Text') {
      return parts[0];
    }
    return node('Interpolation', { parts });
  }
}

// Where an embedded expression starts and which bracket closes it.
const interpolationOpeners = {
  braces: [['{', '}']],
  'dollar-braces': [['${', '}']],
  'hash-braces': [['#{', '}']],
  dollar: [
    ['${', '}'],
    ['{$', '}', '$'],
  ],
  'backslash-parentheses': [['\\(', ')']],
  'dollar-doubled': [['${', '}']],
  'dollar-parentheses': [['$(', ')']],
};
// Styles where $name embeds a variable.
const dollarStyles = new Set([
  'dollar',
  'dollar-doubled',
  'dollar-parentheses',
]);

// Split interpolated text into literal strings and { code } pieces. Nested
// brackets inside the embedded expression are balanced, so "\(f(x))" works.
function splitInterpolation(value, style) {
  const pieces = [];
  let literal = '';
  const flush = () => {
    if (literal) {
      pieces.push(literal);
    }
    literal = '';
  };
  let index = 0;
  while (index < value.length) {
    const code = embeddedCode(value, index, style);
    if (code) {
      flush();
      pieces.push({ code: code.code });
      index = code.end;
      continue;
    }
    const length = literalLength(value, index, style);
    // A doubled brace stands for one brace.
    literal +=
      length === 2 && value[index] !== '\\'
        ? value[index]
        : value.slice(index, index + length);
    index += length;
  }
  flush();
  return pieces;
}

// How many characters of literal text start at index: an escape sequence or
// a doubled brace counts as two.
function literalLength(value, index, style) {
  if (value[index] === '\\' && style !== 'backslash-parentheses') {
    return 2;
  }
  if (
    style === 'braces' &&
    (value.startsWith('{{', index) || value.startsWith('}}', index))
  ) {
    return 2;
  }
  if (style === 'dollar-doubled' && value.startsWith('$$', index)) {
    return 2;
  }
  return value[index] === '\\' && !value.startsWith('\\(', index) ? 2 : 1;
}

// Code embedded in text at index, with the index just after it.
function embeddedCode(value, index, style) {
  if (literalLength(value, index, style) === 2) {
    return undefined;
  }
  const opener = interpolationOpeners[style].find(([open]) =>
    value.startsWith(open, index)
  );
  if (!opener) {
    const variable =
      dollarStyles.has(style) && /^\$[A-Za-z_]\w*/.exec(value.slice(index));
    return variable
      ? { code: variable[0].slice(1), end: index + variable[0].length }
      : undefined;
  }
  const [open, close, keep = ''] = opener;
  const end = closingIndex(value, index + open.length, close);
  return { code: keep + value.slice(index + open.length, end - 1), end };
}

// The index just after the bracket that closes one already opened.
function closingIndex(value, start, close) {
  const inner = close === '}' ? '{' : '(';
  let depth = 1;
  let end = start;
  for (; end < value.length && depth > 0; end += 1) {
    depth += value[end] === inner ? 1 : value[end] === close ? -1 : 0;
  }
  if (depth !== 0) {
    throw new SyntaxError(`Unclosed "${inner}" in text`, 0);
  }
  return end;
}

function calleeName(expression) {
  if (expression.kind !== 'Name') {
    throw new SyntaxError('Only named functions can be called', 0);
  }
  return expression.name;
}

// A number as written: 1.5, 2.0 and 1e3 are reals, 7 is an integer.
export function numberLiteral(written) {
  const literal = number(Number(written));
  return /[.eE]/.test(written) ? { ...literal, type: 'real' } : literal;
}

// Arrays, loops and type hints are read by mixins of their own, which the
// dialects inherit.
const Parser = withFunctionForms(withLoops(withArrays(BaseParser)));

// Map a source type spelling to a meta type.
export function sourceType(spelling) {
  const words = spelling
    .replace(/\b(const|static|unsigned|signed|mut)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (
    /^(int|long|short|i8|i16|i32|i64|isize|u8|u16|u32|u64|usize|Int|Long|number|integer)$/.test(
      words
    )
  ) {
    return 'integer';
  }
  if (
    /^(char ?\*|std ?:: ?string|string|String|& ?str|&'static str)$/.test(words)
  ) {
    return 'text';
  }
  if (
    /^((int|long|Long|number|i64) ?\[ ?\]|std ?:: ?vector ?< ?int ?>|Vec ?< ?i64 ?>|IntArray|\[ ?\] ?int|\[ ?Int ?\]|List ?< ?(int|Long) ?>|Array ?\[ ?Long ?\]|seq ?\[ ?int ?\]|\[ ?(\d+ ?)?\] ?i64)$/.test(
      words
    )
  ) {
    return 'array';
  }
  if (
    /^(double|float|f32|f64|float32|float64|Double|Float|Float64|Long_Float|real|Real)$/.test(
      words
    )
  ) {
    return 'real';
  }
  if (/^(bool|boolean|Bool|Boolean)$/.test(words)) {
    return 'boolean';
  }
  if (/^(void|\(\)|Unit|Void)$/.test(words)) {
    return 'nothing';
  }
  if (words === '' || words === 'var' || words === 'auto') {
    return undefined;
  }
  return `source:${words}`;
}

const elseWords = ['else', 'elif', 'elsif', 'elseif'];
const startsElse = (parser, offset = 0) =>
  [...elseWords, parser.syntax.elseIf ?? 'else'].some((word) =>
    parser.is(word, offset)
  );
const assignmentSymbols = ['=', '+=', '-=', '*=', '/=', '%=', '++', '--'];
