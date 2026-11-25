// Ada (GNAT): a main procedure whose declarative part holds the
// subprograms and variables, and whose statements follow begin.

import { add, block, laterCalls, node, number, text, walk } from '../meta.js';
import { offset } from '../arrays.js';
import { declaredVariables, keywordParser } from './shared.js';

// The output procedures of Ada.Text_IO and of an Integer_IO instance.
const outputWords = new Set(['put', 'put_line', 'new_line']);

// Statements: if, while, for, return, null, assignments, calls and output.
const statements = (Base) =>
  class AdaStatements extends Base {
    statement() {
      if (this.accept('if')) {
        return this.adaIf();
      }
      if (this.accept('while')) {
        const condition = this.expression();
        return node('While', { condition, body: this.loopBody() });
      }
      if (this.accept('for')) {
        return this.adaFor();
      }
      if (this.accept('return')) {
        const value = this.is(';') ? undefined : this.expression();
        return node('Return', { value });
      }
      if (outputWords.has(this.peek().value.toLowerCase())) {
        return this.output();
      }
      if (this.accept('declare')) {
        return this.declareBlock();
      }
      const store = this.isElementAssignment();
      if (store) {
        return this.elementAssignment(store);
      }
      if (this.peek().type === 'name' && this.is(':=', 1)) {
        const name = this.next().value;
        this.next();
        return node('Assignment', {
          name,
          operator: '=',
          value: this.expression(),
        });
      }
      return node('Evaluate', { expression: this.called(this.expression()) });
    }

    // declare Name : Integer_Array (0 .. Last) := ...; begin ... end; holds
    // arrays and the statements after them, which the meta program lists
    // in the same block.
    declareBlock() {
      const statements = [];
      this.skipLines();
      while (!this.accept('begin')) {
        const variable = this.expectName();
        this.expect(':');
        this.accept('constant');
        this.expectName();
        this.expect('(');
        this.expression();
        this.expect('..');
        const last = this.expression();
        this.expect(')');
        this.expect(':=');
        statements.push(
          node('Declaration', {
            name: variable,
            type: 'array',
            value: this.aggregate(offset(last, 1)),
          })
        );
        this.expect(';');
        this.skipLines();
      }
      statements.push(...this.statementsUntil(() => this.is('end')));
      this.expect('end');
      return node('Sequence', { statements });
    }

    // [others => V] is the array of n values V; [A, B] and [0 => A] list
    // the values. Ada 2022 writes array aggregates in square brackets;
    // the older parentheses are read too.
    aggregate(length) {
      const close = this.accept('[') ? ']' : (this.expect('('), ')');
      if (this.accept('others')) {
        this.expect('=>');
        const fill = this.expression();
        this.expect(close);
        return length.kind === 'Number' && length.value === 0
          ? node('ArrayLiteral', { elements: [] })
          : node('NewArray', { length, fill });
      }
      if (this.peek().type === 'number' && this.is('=>', 1)) {
        this.position += 2;
      }
      return this.literal(close);
    }

    // Numbers'Length.
    primary() {
      const value = super.primary();
      if (value.kind === 'Name' && this.is("'") && this.is('length', 1)) {
        this.position += 2;
        return node('Length', { array: value });
      }
      return value;
    }

    // Put (A, 0); Put (": "); Put_Line (B); on one line print one line.
    output() {
      const parts = [];
      while (outputWords.has(this.peek().value.toLowerCase())) {
        const word = this.next().value.toLowerCase();
        if (word === 'new_line') {
          this.accept(';');
          return node('Print', { value: this.joined(parts), newline: true });
        }
        this.expect('(');
        parts.push(this.expression());
        // The width of an integer, always 0.
        if (this.accept(',')) {
          this.expression();
        }
        this.expect(')');
        this.accept(';');
        if (word === 'put_line') {
          return node('Print', { value: this.joined(parts), newline: true });
        }
      }
      return node('Print', { value: this.joined(parts), newline: false });
    }

    joined(parts) {
      if (parts.length === 0) {
        return text('');
      }
      return parts.length === 1
        ? parts[0]
        : node('Interpolation', { parts, type: 'text' });
    }

    // for I in T range First .. Last loop: the meta loop stops before its end.
    adaFor() {
      const variable = this.expectName();
      this.expect('in');
      if (this.is('range', 1)) {
        this.position += 2;
      }
      const start = this.expression();
      this.expect('..');
      const last = this.expression();
      return node('CountingLoop', {
        variable,
        start,
        end: add(last, number(1)),
        body: this.loopBody(),
      });
    }

    loopBody() {
      this.expect('loop');
      const body = this.statementsUntil(() => this.is('end'));
      this.expect('end');
      this.expect('loop');
      return block(body);
    }

    // if ... then ... elsif ... then ... else ... end if;
    adaIf() {
      const condition = this.expression();
      this.expect('then');
      const then = block(
        this.statementsUntil(
          () => this.is('elsif') || this.is('else') || this.is('end')
        )
      );
      if (this.accept('elsif')) {
        return node('If', { condition, then, otherwise: this.adaIf() });
      }
      let otherwise;
      if (this.accept('else')) {
        otherwise = block(this.statementsUntil(() => this.is('end')));
      }
      this.expect('end');
      this.expect('if');
      return node('If', { condition, then, otherwise });
    }
  };

const parser = (Base) =>
  class AdaParser extends statements(keywordParser(Base)) {
    // `null;` stands for a block without statements.
    statementsUntil(done) {
      return super
        .statementsUntil(() => {
          while (this.accept('null')) {
            this.skipLines();
          }
          return done();
        })
        .flatMap((statement) =>
          statement.kind === 'Sequence' ? statement.statements : [statement]
        );
    }

    // "and then" and "or else" are single operators.
    constructor(tokens, syntax) {
      const merged = [];
      for (const token of tokens) {
        const previous = merged.at(-1)?.value.toLowerCase();
        const word = token.value?.toLowerCase?.();
        if (
          token.type === 'name' &&
          ((previous === 'and' && word === 'then') ||
            (previous === 'or' && word === 'else'))
        ) {
          merged.at(-1).value = `${previous} ${word}`;
        } else {
          merged.push({ ...token });
        }
      }
      super(merged, syntax);
    }

    program() {
      const items = [];
      this.gatherComments(items);
      while (this.is('with') || this.is('use')) {
        this.skipLine();
        this.skipLines();
        this.gatherComments(items);
      }
      this.expect('procedure');
      this.expectName();
      this.expect('is');
      while (!this.accept('begin')) {
        this.gatherComments(items);
        this.skipLines();
        if (this.is('function') || this.is('procedure')) {
          const routine = this.routine();
          if (routine) {
            items.push(routine);
          }
        } else if (!this.is('begin')) {
          this.skipDeclaration();
        }
      }
      items.push(...this.statementsUntil(() => this.is('end')));
      this.expect('end');
      this.skipLine();
      this.skipLines();
      return node('SourceProgram', { language: this.syntax.id, items });
    }

    // A variable, a package instance or a use clause, up to its semicolon.
    skipDeclaration() {
      while (!this.accept(';')) {
        this.next();
      }
    }

    // function Name (A, B : T; C : T) return T is ... begin ... end Name;
    // A heading that ends with a semicolon only announces the body.
    routine() {
      const isFunction = this.next().value.toLowerCase() === 'function';
      const name = this.expectName();
      const parameters = [];
      if (this.accept('(')) {
        while (!this.is(')')) {
          const names = [this.expectName()];
          while (this.accept(',')) {
            names.push(this.expectName());
          }
          this.expect(':');
          this.accept('in');
          const type = this.typeOf(this.expectName());
          names.forEach((parameter) =>
            parameters.push({ name: parameter, type })
          );
          if (!this.accept(';')) {
            break;
          }
        }
        this.expect(')');
      }
      const returnType = isFunction
        ? (this.expect('return'), this.typeOf(this.expectName()))
        : 'nothing';
      if (this.accept(';')) {
        return undefined;
      }
      this.expect('is');
      this.skipLines();
      while (!this.accept('begin')) {
        this.skipDeclaration();
        this.skipLines();
      }
      const body = this.statementsUntil(() => this.is('end'));
      this.expect('end');
      this.skipLine();
      // `Number := Initial_Number;` first declares the copy of a parameter.
      const copied = (statement) =>
        statement.kind === 'Assignment' &&
        parameters.some(({ name: source }) => source === statement.value.name);
      for (let index = 0; body[index] && copied(body[index]); index += 1) {
        const { name: copy, value } = body[index];
        body[index] = node('Declaration', { name: copy, value, mutable: true });
      }
      return node('Function', {
        name,
        parameters,
        returnType,
        body: block(body),
      });
    }
  };

// Output statements, which Ada writes one item at a time.
const outputEmitter = (Base) =>
  class AdaOutputEmitter extends Base {
    // Integers are written by an Integer_IO instance, without padding.
    put(part, last) {
      const value = this.expression(part);
      if (part.kind === 'Text' || part.type === 'text') {
        this.uses.add('text_io');
        return `${last ? 'Put_Line' : 'Put'} (${value});`;
      }
      this.uses.add('text_io');
      this.uses.add('integer_io');
      const written =
        part.type === 'boolean'
          ? `Put (Boolean'Image (${value}));`
          : `Put (${value}, 0);`;
      return last ? `${written} New_Line;` : written;
    }

    print({ value, newline }) {
      const parts = value.kind === 'Interpolation' ? value.parts : [value];
      if (newline && parts.length === 1 && parts[0].kind === 'Text') {
        this.uses.add('text_io');
        return parts[0].value === ''
          ? 'New_Line;'
          : `Put_Line (${this.expression(parts[0])});`;
      }
      return parts
        .map((part, index) =>
          this.put(part, newline && index === parts.length - 1)
        )
        .join(' ');
    }
  };

// Whether a statement after an array's declaration stores into it. GNAT
// (-gnatwk) wants an array that nothing stores into to be constant.
const changes = (statements, name) => {
  let found = false;
  walk({ kind: 'Block', statements }, (current) => {
    if (
      (current.kind === 'IndexAssignment' || current.kind === 'Assignment') &&
      current.name === name
    ) {
      found = true;
    }
  });
  return found;
};

const isArrayDeclaration = (statement) =>
  statement.kind === 'Declaration' &&
  (statement.type === 'array' ||
    ['ArrayLiteral', 'NewArray'].includes(statement.value?.kind));

// Statements and the declarative parts of subprograms.
const statementEmitter = (Base) =>
  class AdaStatementEmitter extends outputEmitter(Base) {
    quote(value) {
      return `"${value.replace(/"/g, '""')}"`;
    }

    // Ada writes a space between a subprogram and its arguments, and calls
    // a subprogram without parameters by its name alone.
    expression(expression, parent = 0) {
      if (expression.kind !== 'Call') {
        return super.expression(expression, parent);
      }
      const values = expression.arguments.map((value) =>
        this.expression(value)
      );
      return values.length
        ? `${expression.callee} (${values.join(', ')})`
        : expression.callee;
    }

    // An array is declared, with its bounds, in a declare block that holds
    // the statements after it.
    body(statements) {
      if (statements.statements.length === 0) {
        this.line('null;');
      }
      const all = statements.statements;
      const first = all.findIndex(isArrayDeclaration);
      if (first < 0) {
        super.body(statements);
        return;
      }
      super.body({ ...statements, statements: all.slice(0, first) });
      let last = first;
      while (last < all.length && isArrayDeclaration(all[last])) {
        last += 1;
      }
      this.line('declare');
      this.depth += 1;
      all.slice(first, last).forEach((statement) => {
        this.line(
          this.arrayDeclaration(
            statement,
            !changes(all.slice(last), statement.name)
          )
        );
      });
      this.depth -= 1;
      this.line('begin');
      this.indented({ ...statements, statements: all.slice(last) });
      this.line('end;');
    }

    // Name : Integer_Array (0 .. Last) := [others => V], or the values.
    arrayDeclaration({ name, value }, constant = false) {
      this.uses.add('array');
      const length =
        value.kind === 'NewArray'
          ? value.length
          : number(value.elements.length);
      const bounds = `0 .. ${this.expression(offset(length, -1))}`;
      let values;
      if (value.kind === 'NewArray' || value.elements.length === 0) {
        values = `[others => ${this.expression(value.fill ?? number(0))}]`;
      } else {
        const elements = value.elements.map((element) =>
          this.expression(element)
        );
        values =
          elements.length === 1
            ? `[0 => ${elements[0]}]`
            : `[${elements.join(', ')}]`;
      }
      const type = constant ? 'constant Integer_Array' : 'Integer_Array';
      return `${name} : ${type} (${bounds}) := ${values};`;
    }

    declaration({ name, value }) {
      return `${name} := ${this.expression(value ?? number(0))};`;
    }

    indented(body) {
      this.depth += 1;
      this.body(body);
      this.depth -= 1;
    }

    ifStatement(statement) {
      this.line(`if ${this.expression(statement.condition)} then`);
      let current = statement;
      this.indented(current.then);
      while (current.otherwise?.kind === 'If') {
        current = current.otherwise;
        this.line(`elsif ${this.expression(current.condition)} then`);
        this.indented(current.then);
      }
      if (current.otherwise) {
        this.line('else');
        this.indented(current.otherwise);
      }
      this.line('end if;');
    }

    whileStatement({ condition, body }) {
      this.line(`while ${this.expression(condition)} loop`);
      this.indented(body);
      this.line('end loop;');
    }

    // The loop declares its own variable, of the type its range names
    // (literal bounds alone would make it an Integer).
    countingLoop({ variable, start, end, body }) {
      const last = this.expression(add(end, number(-1)));
      const range = `${this.type('integer')} range ${this.expression(start)} .. ${last}`;
      this.line(`for ${variable} in ${range} loop`);
      this.indented(body);
      this.line('end loop;');
    }

    // Name : Long_Long_Integer;
    variables(body) {
      const variables = declaredVariables(body, { loops: false });
      for (const [variable, type] of variables) {
        if (type === 'array') {
          variables.delete(variable);
          continue;
        }
        this.line(`${variable} : ${this.type(type)};`);
      }
      return variables.size;
    }

    heading(item) {
      const parameters = item.parameters
        .map(({ name, type }) => `${name} : ${this.type(type)}`)
        .join('; ');
      const list = parameters ? ` (${parameters})` : '';
      return item.returnType === 'nothing'
        ? `procedure ${item.name}${list}`
        : `function ${item.name}${list} return ${this.type(item.returnType)}`;
    }

    functionDefinition(item) {
      for (const text of item.comments ?? []) {
        this.comment(text);
      }
      this.line(`${this.heading(item)} is`);
      this.depth += 1;
      this.variables(item.body);
      this.depth -= 1;
      this.line('begin');
      this.indented(item.body);
      this.line(`end ${item.name};`);
    }
  };

const emitter = (Base) =>
  class AdaEmitter extends statementEmitter(Base) {
    // The subprograms come first, announced by their specifications when
    // an earlier one calls them, then the variables of the main procedure.
    program(program) {
      this.depth = 1;
      const announced = this.announcements(program.functions);
      for (const item of program.functions) {
        this.functionDefinition(item);
        this.line();
      }
      if (this.variables(program.main)) {
        this.line();
      }
      this.depth = 0;
      this.line('begin');
      this.depth = 1;
      for (const text of program.mainComments ?? []) {
        this.comment(text);
      }
      this.body(program.main);
      this.depth = 0;
      this.line('end Main;');
      const body = this.lines;
      this.lines = [];
      for (const text of program.comments) {
        this.comment(text);
      }
      if (program.comments.length) {
        this.line();
      }
      this.prelude(program);
      return `${[...this.lines, ...announced, ...body].join('\n')}\n`;
    }

    announcements(functions) {
      const lines = laterCalls(functions).map(
        (item) => `    ${this.heading(item)};`
      );
      return lines.length ? [...lines, ''] : [];
    }

    // with clauses, the main procedure and the Integer_IO instance.
    prelude(program) {
      const units = [
        ...(this.uses.has('text_io') ? ['Ada.Text_IO'] : []),
        ...(program.libraryImports ?? []),
      ];
      for (const unit of units) {
        this.line(`with ${unit}; use ${unit};`);
      }
      if (units.length) {
        this.line();
      }
      this.line('procedure Main is');
      if (this.uses.has('integer_io')) {
        this.line(
          '    package Long_IO is new Integer_IO (Long_Long_Integer); use Long_IO;'
        );
        this.line();
      }
      if (this.uses.has('array')) {
        this.line(
          '    type Integer_Array is array (Long_Long_Integer range <>) of Long_Long_Integer;'
        );
        this.line();
      }
    }
  };

export const ada = { parser, emitter };
