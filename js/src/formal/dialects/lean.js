// Lean 4: every function is a `partial def` whose body is a do block. A
// function that returns a value runs in the identity monad (`Id.run do`),
// so it computes without output; a procedure and main run in `IO`, where
// prints happen. Variables are `let` (or `let mut` when they change) with
// their type, a counting loop is `for i in (a : Int)...<b do`, and
// functions call each other by juxtaposition: `f a (b + 1)`. Integers are
// Int, so division and remainder truncate with Int.tdiv and Int.tmod, and
// an array index becomes a natural number with Int.toNat.

import { laterCalls, name, node } from '../../meta/tree.js';
import { SyntaxError } from '../lexer.js';
import { defaultValues } from './shared.js';

// Words that end an application: `if f x then`, `for i in ... do`.
const keywords = new Set([
  'then',
  'else',
  'do',
  'in',
  'with',
  'if',
  'let',
  'mut',
  'return',
  'for',
  'while',
  'fun',
  'def',
  'partial',
]);

// The meta types of Lean's type spellings.
const metaTypes = {
  Int: 'integer',
  String: 'text',
  Bool: 'boolean',
  Unit: 'nothing',
  'IO Unit': 'nothing',
  'Array Int': 'array',
};

// Marks `()`, the argument of a function without parameters.
const unitArgument = { kind: 'Unit' };

// Statements of a do block.
const statementParser = (Base) =>
  class LeanStatementParser extends Base {
    statement() {
      if (this.is('let')) {
        return this.letStatement();
      }
      if (this.peek().type === 'name' && this.is(':=', 1)) {
        return this.assignment();
      }
      if (this.is('if')) {
        return this.ifStatement();
      }
      if (this.is('while')) {
        return this.whileStatement();
      }
      if (this.is('for')) {
        return this.forStatement();
      }
      if (this.is('return')) {
        this.next();
        const value = this.isStatementEnd() ? undefined : this.expression();
        this.endStatement();
        return node('Return', { value });
      }
      if (this.isPrint()) {
        return this.printStatement();
      }
      // `pure ()` is an empty block.
      if (this.is('pure') && this.is('(', 1) && this.is(')', 2)) {
        this.position += 3;
        this.endStatement();
        return node('Statements', { statements: [] });
      }
      const expression = this.expression();
      this.endStatement();
      return node('Evaluate', { expression });
    }

    isPrint() {
      return (
        this.is('IO') &&
        this.is('.', 1) &&
        ['println', 'print'].includes(this.peek(2).value)
      );
    }

    // IO.println value and IO.print value.
    printStatement() {
      const newline = this.peek(2).value === 'println';
      this.position += 3;
      const value = this.atom();
      this.endStatement();
      return node('Print', { value, newline });
    }

    // while c do <block>
    whileStatement() {
      this.next();
      const condition = this.expression();
      this.expect('do');
      return node('While', { condition, body: this.indentedBlock() });
    }

    isStatementEnd() {
      return ['newline', 'dedent', 'end'].includes(this.peek().type);
    }

    // let x : Int := v, let mut x : Int := v and let _ := f x.
    letStatement() {
      this.next();
      const mutable = Boolean(this.accept('mut'));
      const variable = this.expectName();
      const type = this.accept(':') ? this.typeUntil(':=') : undefined;
      this.expect(':=');
      const value = this.expression();
      this.endStatement();
      if (variable === '_') {
        return node('Evaluate', { expression: value });
      }
      return node('Declaration', { name: variable, type, value, mutable });
    }

    // x := v, and x := x.set! i v, which changes one element.
    assignment() {
      const variable = this.next().value;
      this.next();
      const value = this.expression();
      this.endStatement();
      if (value.kind === 'Call' && value.callee === `${variable}.set!`) {
        const [index, element] = value.arguments;
        return node('IndexAssignment', {
          name: variable,
          index,
          value: element,
        });
      }
      return node('Assignment', { name: variable, operator: '=', value });
    }

    // if c then <block> else if d then <block> else <block>
    ifStatement() {
      this.next();
      const condition = this.expression();
      this.expect('then');
      const then = this.indentedBlock();
      let otherwise;
      if (this.accept('else')) {
        otherwise = this.is('if') ? this.ifStatement() : this.indentedBlock();
      }
      return node('If', { condition, then, otherwise });
    }

    // for i in (a : Int)...<b do <block>
    forStatement() {
      this.next();
      const variable = this.expectName();
      this.expect('in');
      this.expect('(');
      const start = this.expression();
      this.expect(':');
      this.expectName();
      this.expect(')');
      this.expect('...<');
      const end = this.expression();
      this.expect('do');
      return node('CountingLoop', {
        variable,
        start,
        end,
        body: this.indentedBlock(),
      });
    }
  };

// Applications, literals, arrays and indexes.
const expressionParser = (Base) =>
  class LeanExpressionParser extends statementParser(Base) {
    // Whether the next token starts an argument of an application.
    startsAtom() {
      const token = this.peek();
      if (token.type === 'number' || token.type === 'text') {
        return true;
      }
      if (token.type === 'name') {
        return !keywords.has(token.value);
      }
      return this.is('(') || (this.is('#') && this.is('[', 1));
    }

    // f a b: a name applied to the atoms after it.
    postfix() {
      const head = this.atom();
      if (head.kind !== 'Name' || !this.startsAtom()) {
        return head;
      }
      const values = [];
      while (this.startsAtom()) {
        values.push(this.atom());
      }
      return this.application(
        head.name,
        values.filter((value) => value !== unitArgument)
      );
    }

    // The library functions the emitter writes for meta operations.
    application(callee, values) {
      const [first, second] = values;
      switch (callee) {
        case 'Int.tdiv':
          return node('Binary', {
            operator: 'divide',
            left: first,
            right: second,
          });
        case 'Int.tmod':
          return node('Binary', {
            operator: 'remainder',
            left: first,
            right: second,
          });
        case 'Int.toNat':
          return first;
        case 'Int.ofNat':
          return first.kind === 'Name' && first.name.endsWith('.size')
            ? node('Length', { array: name(first.name.slice(0, -5)) })
            : first;
        case 'Array.replicate':
          return node('NewArray', { length: first, fill: second });
        default:
          return node('Call', { callee, arguments: values });
      }
    }

    // A literal, a parenthesized expression (perhaps with a type), an
    // array #[a, b], or a dotted name with an optional index a[i]!.
    atom() {
      if (this.accept('(')) {
        if (this.accept(')')) {
          return unitArgument;
        }
        const inner = this.expression();
        if (this.accept(':')) {
          this.typeUntil(')');
        }
        this.expect(')');
        return inner;
      }
      if (this.is('#') && this.is('[', 1)) {
        this.position += 2;
        return this.literal(']');
      }
      if (this.peek().type !== 'name') {
        return super.primary();
      }
      if (this.is('true') || this.is('false')) {
        return node('Boolean', { value: this.next().value === 'true' });
      }
      let written = this.next().value;
      while (this.is('.') && this.peek(1).type === 'name') {
        this.next();
        written += `.${this.next().value}`;
      }
      if (this.accept('[')) {
        const index = this.expression();
        this.expect(']');
        this.expect('!');
        return node('Index', { array: name(written), index });
      }
      return name(written);
    }
  };

const parser = (Base) =>
  class LeanParser extends expressionParser(Base) {
    item() {
      const token = this.peek();
      if (token.type === 'comment') {
        this.next();
        return node('Comment', { text: token.value });
      }
      if (this.is('import')) {
        this.next();
        const words = [];
        while (this.peek().type === 'name' || this.is('.')) {
          words.push(this.next().value);
        }
        return node('Import', { text: `import ${words.join('')}` });
      }
      // `mutual ... end` only lets functions call each other.
      if (this.is('mutual') || this.is('end')) {
        this.next();
        return node('Statements', { statements: [] });
      }
      if (this.is('partial') || this.is('def')) {
        return this.definition();
      }
      return this.statement();
    }

    // The words of a type up to the symbol that ends it.
    typeUntil(stop) {
      const words = [];
      while (!this.is(stop) && this.peek().type !== 'end') {
        words.push(this.next().value);
      }
      const spelled = words.join(' ');
      return metaTypes[spelled] ?? spelled;
    }

    // partial def name (a : Int) (b : Int) : Int := Id.run do <block>
    definition() {
      this.accept('partial');
      this.expect('def');
      const functionName = this.expectName();
      const parameters = [];
      while (this.accept('(')) {
        const parameter = this.expectName();
        this.expect(':');
        const type = this.typeUntil(')');
        this.expect(')');
        // (_ : Unit) stands for no parameters.
        if (parameter !== '_') {
          parameters.push({ name: parameter, type });
        }
      }
      this.expect(':');
      const returnType = this.typeUntil(':=');
      this.expect(':=');
      if (this.accept('Id')) {
        this.expect('.');
        this.expect('run');
      }
      this.expect('do');
      const body = this.indentedBlock();
      // `return default` only satisfies Lean after a last statement that
      // does not return.
      const last = body.statements.at(-1);
      if (last?.kind === 'Return' && last.value?.name === 'default') {
        body.statements.pop();
      }
      return node('Function', {
        name: functionName,
        parameters,
        returnType,
        body,
      });
    }

    // The statements indented below the line that opens a block.
    indentedBlock() {
      while (this.peek().type === 'newline') {
        this.next();
      }
      if (this.next().type !== 'indent') {
        throw new SyntaxError('Expected an indented block', this.peek().line);
      }
      const statements = this.items(
        () => this.peek().type === 'dedent' || this.peek().type === 'end'
      );
      this.next();
      return node('Block', { statements });
    }
  };

// Statements of a do block.
const statementEmitter = (Base) =>
  class LeanStatementEmitter extends Base {
    constructor(syntax) {
      super(syntax);
      this.unit = '  ';
    }

    indented(block) {
      this.depth += 1;
      this.body(block);
      this.depth -= 1;
    }

    statement(statement) {
      switch (statement.kind) {
        case 'Print':
          return this.line(
            `IO.${statement.newline ? 'println' : 'print'} ${this.expression(statement.value, 8)}`
          );
        case 'Evaluate': {
          // A value nobody reads is bound to _.
          const { expression } = statement;
          const written = this.expression(expression);
          return this.line(
            expression.type && expression.type !== 'nothing'
              ? `let _ := ${written}`
              : written
          );
        }
        case 'Return':
          return this.line(
            statement.value
              ? `return ${this.expression(statement.value)}`
              : 'return'
          );
        case 'Declaration':
          return this.line(this.declaration(statement));
        case 'Assignment':
          return this.line(
            `${statement.name} := ${this.expression(statement.value)}`
          );
        case 'IndexAssignment': {
          const { name: array, index, value } = statement;
          return this.line(
            `${array} := ${array}.set! ${this.natural(index, 8)} ${this.expression(value, 8)}`
          );
        }
        case 'If':
          return this.ifStatement(statement);
        case 'While':
          this.line(`while ${this.expression(statement.condition)} do`);
          return this.indented(statement.body);
        case 'CountingLoop': {
          const { variable, start, end, body } = statement;
          this.line(
            `for ${variable} in (${this.expression(start)} : Int)...<${this.expression(end)} do`
          );
          return this.indented(body);
        }
        default:
          return super.statement(statement);
      }
    }

    // A variable that changes, or whose elements change, is `let mut`.
    declaration(statement) {
      const { name: variable, value } = statement;
      const array = ['ArrayLiteral', 'NewArray'].includes(value?.kind);
      const type = array ? 'array' : (statement.type ?? 'integer');
      const initial = value ?? defaultValues[type] ?? defaultValues.integer;
      const changes = statement.mutable || statement.elementsAssigned;
      return `let ${changes ? 'mut ' : ''}${variable} : ${this.type(type)} := ${this.expression(initial)}`;
    }

    ifStatement({ condition, then, otherwise }) {
      this.line(`if ${this.expression(condition)} then`);
      this.indented(then);
      let rest = otherwise;
      while (rest?.kind === 'If') {
        this.line(`else if ${this.expression(rest.condition)} then`);
        this.indented(rest.then);
        rest = rest.otherwise;
      }
      if (rest?.statements.length) {
        this.line('else');
        this.indented(rest);
      }
    }
  };

const emitter = (Base) =>
  class LeanEmitter extends statementEmitter(Base) {
    // An array index is a natural number.
    natural(index, parent) {
      if (index.kind === 'Number' && index.value >= 0) {
        return String(index.value);
      }
      const written = `Int.toNat ${this.expression(index, 8)}`;
      return parent > 6 ? `(${written})` : written;
    }

    // Applications bind tighter than every operator, but not than `!` and
    // `-`, and an argument that is not a single word is parenthesized.
    applied(written, parent) {
      return parent > 6 ? `(${written})` : written;
    }

    application(callee, values, parent) {
      const written = values.length
        ? values.map((value) => this.expression(value, 8)).join(' ')
        : '()';
      return this.applied(`${callee} ${written}`, parent);
    }

    expression(expression, parent = 0) {
      switch (expression.kind) {
        case 'Call':
          return this.application(
            expression.callee,
            expression.arguments,
            parent
          );
        case 'ArrayLiteral':
          return `#[${expression.elements.map((element) => this.expression(element)).join(', ')}]`;
        case 'NewArray':
          return this.applied(
            `Array.replicate ${this.natural(expression.length, 8)} ${this.expression(expression.fill, 8)}`,
            parent
          );
        case 'Index':
          return `${expression.array.name}[${this.natural(expression.index, 0)}]!`;
        case 'Length':
          return this.applied(
            `Int.ofNat ${expression.array.name}.size`,
            parent
          );
        default:
          return super.expression(expression, parent);
      }
    }

    binary(expression, parent) {
      const spelled = { divide: 'Int.tdiv', remainder: 'Int.tmod' }[
        expression.operator
      ];
      if (!spelled) {
        return super.binary(expression, parent);
      }
      return this.application(
        spelled,
        [expression.left, expression.right],
        parent
      );
    }

    // s!"text {value}": a brace in the text is escaped.
    interpolation(parts) {
      const written = parts
        .map((part) =>
          part.kind === 'Text'
            ? this.escape(part.value).replace(/\{/g, '\\{')
            : `{${this.expression(part)}}`
        )
        .join('');
      return `s!"${written}"`;
    }

    signature(item) {
      const parameters = item.parameters.length
        ? item.parameters
            .map(
              ({ name: parameter, type }) =>
                `(${parameter} : ${this.type(type)})`
            )
            .join(' ')
        : '(_ : Unit)';
      return this.procedure(item)
        ? `partial def ${item.name} ${parameters} : IO Unit := do`
        : `partial def ${item.name} ${parameters} : ${this.type(item.returnType)} := Id.run do`;
    }

    procedure(item) {
      return !item.returnType || item.returnType === 'nothing';
    }

    functionDefinition(item) {
      for (const text of item.comments ?? []) {
        this.comment(text);
      }
      this.line(this.signature(item));
      this.indented(item.body);
      // A value function whose last statement does not return still needs a
      // value at its end.
      if (
        !this.procedure(item) &&
        item.body.statements.at(-1)?.kind !== 'Return'
      ) {
        this.depth += 1;
        this.line('return default');
        this.depth -= 1;
      }
    }

    // Functions that call a function defined after them are one mutual
    // group.
    program(program) {
      const mutual = laterCalls(program.functions).length > 0;
      return super.program(
        mutual ? { ...program, mutualGroup: true } : program
      );
    }

    main(program) {
      if (program.mutualGroup) {
        // The group opens above the first function and its comments and
        // closes after the last function, before the blank line.
        this.lines.unshift('mutual');
        this.lines.splice(this.lines.length - 1, 0, 'end');
      }
      for (const text of program.mainComments ?? []) {
        this.comment(text);
      }
      this.line('def main : IO Unit := do');
      this.indented(program.main);
    }
  };

export const lean = { parser, emitter };
