// Rocq: a program is a set of pure functions that compute its output as a
// string. The runtime in the header of every program (languages.js) gives
// statements a meaning: an action takes the output written so far and either
// goes on with a state or returns a result. Statements are joined with
// `;;`, a variable is a `let` that a later `let` shadows, and an if or a
// loop hands the variables it assigns back as its state:
//
//   '(sum, divisor) <- loop_while (fun '(sum, divisor) => c) (fun '(sum,
//   divisor) => ... pure (sum, divisor)) (sum, divisor) ;;
//
// A function is a Fixpoint whose body is an action: `value (...)` keeps the
// result of a function that returns one, and a procedure is the action
// itself. The last command evaluates `run main`, which Rocq prints.

import { mappedLine } from '../../translation/emission-map.js';
import { laterCalls, name, node } from '../../meta/tree.js';
import {
  blankNode,
  commentNode,
  defaultValues,
  eachStatement,
} from './shared.js';

// Words that end an application: `if f x then`, `let x := f y in`.
const keywords = new Set([
  'then',
  'else',
  'in',
  'with',
  'if',
  'let',
  'fun',
  'end',
  'match',
  'stop',
  'pure',
]);

// The meta types of Rocq's type spellings.
const metaTypes = {
  Z: 'integer',
  string: 'text',
  bool: 'boolean',
  unit: 'nothing',
  'list Z': 'array',
  'Action unit unit': 'nothing',
};

// Marks `tt`, the argument of a function without parameters.
const unitArgument = { kind: 'Unit' };

// The comparisons, which Rocq spells with a question mark.
const comparisons = {
  less: '<?',
  lessOrEqual: '<=?',
  greater: '>?',
  greaterOrEqual: '>=?',
};

// Ifs and loops, with the state they hand back.
const controlParser = (Base) =>
  class RocqControlParser extends Base {
    // The variables an if or a loop hands back: x <- or '(a, b) <-.
    binder() {
      if (this.is("'")) {
        this.pattern();
        this.expect('<-');
      } else if (this.peek().type === 'name' && this.is('<-', 1)) {
        this.position += 2;
      }
    }

    // _, x or '(a, b): the state a function of a loop receives.
    pattern() {
      if (this.accept("'")) {
        this.state();
      } else {
        this.next();
      }
    }

    // tt, x or (a, b): a state, which only threads variables through.
    state() {
      if (!this.accept('(')) {
        this.next();
        return;
      }
      let depth = 1;
      while (depth > 0 && this.peek().type !== 'end') {
        const token = this.next();
        depth += { '(': 1, ')': -1 }[token.value] ?? 0;
      }
    }

    // (if c then ... else ...), loop_while and for_range.
    control() {
      if (this.accept('(')) {
        const statement = this.ifStatement();
        this.expect(')');
        return statement;
      }
      if (this.accept('loop_while')) {
        this.expect('(');
        this.expect('fun');
        this.pattern();
        this.expect('=>');
        const condition = this.expression();
        this.expect(')');
        const { body } = this.loopBody(false);
        return node('While', { condition, body });
      }
      this.expect('for_range');
      const start = this.atom();
      const end = this.atom();
      const { variable, body } = this.loopBody(true);
      return node('CountingLoop', { variable, start, end, body });
    }

    // (fun '(a, b) => ...) state, with the counter first in a counting loop.
    loopBody(counting) {
      this.expect('(');
      this.expect('fun');
      const variable = counting ? this.expectName() : undefined;
      this.pattern();
      this.expect('=>');
      const body = this.sequence();
      this.expect(')');
      this.state();
      return { variable, body };
    }

    // if c then ... else if d then ... else ...
    ifStatement() {
      this.expect('if');
      const condition = this.expression();
      this.expect('then');
      const then = this.sequence();
      this.expect('else');
      let otherwise;
      if (this.is('if')) {
        otherwise = this.ifStatement();
      } else {
        const block = this.sequence();
        otherwise = block.statements.length ? block : undefined;
      }
      return node('If', { condition, then, otherwise });
    }
  };

// Statements of an action: bindings, prints, ifs and loops.
const statementParser = (Base) =>
  class RocqStatementParser extends controlParser(Base) {
    // The statements of an action up to the `pure` that ends it, or up to
    // a `stop` that is not followed by more statements.
    sequence() {
      const statements = [];
      while (this.peek().type !== 'end') {
        const token = this.peek();
        if (token.type === 'comment') {
          this.next();
          statements.push(commentNode(token));
        } else if (token.type === 'newline') {
          statements.push(...blankNode(this.next(), statements));
        } else if (this.accept('pure')) {
          this.state();
          break;
        } else if (this.accept('stop')) {
          const value = this.expression();
          statements.push(
            node('Return', {
              value: value === unitArgument ? undefined : value,
            })
          );
          if (!this.accept(';;')) {
            break;
          }
        } else {
          statements.push(this.statement());
        }
      }
      return node('Block', { statements });
    }

    statement() {
      if (this.is('let')) {
        return this.letStatement();
      }
      if (this.is('print_line') || this.is('print')) {
        const newline = this.next().value === 'print_line';
        const value = this.atom();
        this.expect(';;');
        return node('Print', { value, newline });
      }
      if (this.accept('call')) {
        const expression = this.atom();
        this.expect(';;');
        return node('Evaluate', { expression });
      }
      this.binder();
      const statement = this.control();
      this.expect(';;');
      return statement;
    }

    // let x : Z := v in, let x := v in and let _ := f x in.
    letStatement() {
      this.next();
      const variable = this.expectName();
      const type = this.accept(':') ? this.typeUntil(':=') : undefined;
      this.expect(':=');
      const value = this.expression();
      this.expect('in');
      if (variable === '_') {
        return node('Evaluate', { expression: value });
      }
      if (type) {
        return node('Declaration', { name: variable, type, value });
      }
      if (
        value.kind === 'Call' &&
        value.callee === 'with_item' &&
        value.arguments[0]?.name === variable
      ) {
        const [, index, element] = value.arguments;
        return node('IndexAssignment', {
          name: variable,
          index,
          value: element,
        });
      }
      return node('Assignment', { name: variable, operator: '=', value });
    }
  };

// Applications, literals and lists.
const expressionParser = (Base) =>
  class RocqExpressionParser extends statementParser(Base) {
    constructor(tokens, syntax) {
      super(tokens, syntax);
      for (const [operator, spelled] of Object.entries(comparisons)) {
        this.levels[3][operator] = [...this.levels[3][operator], spelled];
      }
    }

    // negb (a =? b) is a != b.
    unary() {
      const expression = super.unary();
      if (
        expression.kind === 'Unary' &&
        expression.operator === 'not' &&
        expression.operand.kind === 'Binary' &&
        expression.operand.operator === 'equal'
      ) {
        return node('Binary', {
          ...expression.operand,
          operator: 'notEqual',
        });
      }
      return expression;
    }

    // Whether the next token starts an argument of an application.
    startsAtom() {
      const token = this.peek();
      if (token.type === 'number' || token.type === 'text') {
        return true;
      }
      if (token.type === 'name') {
        return !keywords.has(token.value);
      }
      return this.is('(') || this.is('[');
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

    // The runtime functions the emitter writes for meta operations.
    application(callee, values) {
      const [first, second] = values;
      switch (callee) {
        case 'Z.quot':
          return node('Binary', {
            operator: 'divide',
            left: first,
            right: second,
          });
        case 'Z.rem':
          return node('Binary', {
            operator: 'remainder',
            left: first,
            right: second,
          });
        case 'show':
          return first;
        case 'item':
          return node('Index', { array: first, index: second });
        case 'size':
          return node('Length', { array: first });
        case 'filled':
          return node('NewArray', { length: first, fill: second });
        default:
          return node('Call', { callee, arguments: values });
      }
    }

    // A literal, a parenthesized expression, a list [a; b] or a dotted
    // name.
    atom() {
      if (this.accept('(')) {
        const inner = this.expression();
        this.expect(')');
        return inner;
      }
      if (this.accept('[')) {
        const elements = [];
        while (!this.accept(']')) {
          elements.push(this.expression());
          this.accept(';');
        }
        return node('ArrayLiteral', { elements });
      }
      if (this.peek().type !== 'name') {
        return super.primary();
      }
      if (this.is('true') || this.is('false')) {
        return node('Boolean', { value: this.next().value === 'true' });
      }
      if (this.accept('tt')) {
        return unitArgument;
      }
      let written = this.next().value;
      while (this.is('.') && this.peek(1).type === 'name') {
        this.next();
        written += `.${this.next().value}`;
      }
      return name(written);
    }
  };

const parser = (Base) =>
  class RocqParser extends expressionParser(Base) {
    item() {
      const token = this.peek();
      if (token.type === 'comment') {
        this.next();
        return commentNode(token);
      }
      if (this.is('Load')) {
        const words = this.skipCommand();
        return node('Import', { text: `${words.join(' ')}.` });
      }
      // #[bypass_check(guard)] lets a function call itself freely.
      if (this.is('#') && this.is('[', 1)) {
        while (!this.accept(']')) {
          this.next();
        }
        return node('Statements', { statements: [] });
      }
      if (this.is('Fixpoint') || this.is('with') || this.is('Definition')) {
        return this.definition();
      }
      // Eval and Set only run and print the program.
      this.skipCommand();
      return node('Statements', { statements: [] });
    }

    // The words of a command up to the full stop that ends it.
    skipCommand() {
      const words = [];
      while (!this.is('.') && this.peek().type !== 'end') {
        words.push(this.next().value);
      }
      this.next();
      return words;
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

    // Fixpoint name (a : Z) {struct a} : Z := value (...), `with` for the
    // next function of a group, and Definition main.
    definition() {
      this.next();
      const functionName = this.expectName();
      const parameters = [];
      while (this.accept('(')) {
        const parameter = this.expectName();
        this.expect(':');
        const type = this.typeUntil(')');
        this.expect(')');
        // (no_arguments : unit) stands for no parameters.
        if (type !== 'nothing') {
          parameters.push({ name: parameter, type });
        }
      }
      if (this.accept('{')) {
        this.typeUntil('}');
        this.expect('}');
      }
      this.expect(':');
      const returnType = this.typeUntil(':=');
      this.expect(':=');
      this.accept('value');
      this.expect('(');
      const body = this.sequence();
      this.expect(')');
      this.accept('.');
      // `stop default` only gives a value to a function whose last
      // statement does not return.
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
  };

// The variables a block assigns that it did not declare, in order: the
// state an if or a loop hands back.
function assignedVariables(block) {
  const declared = new Set();
  const assigned = [];
  eachStatement(block, (statement) => {
    if (statement.kind === 'Declaration') {
      declared.add(statement.name);
    } else if (statement.kind === 'CountingLoop') {
      declared.add(statement.variable);
    } else if (
      ['Assignment', 'IndexAssignment'].includes(statement.kind) &&
      !declared.has(statement.name) &&
      !assigned.includes(statement.name)
    ) {
      assigned.push(statement.name);
    }
  });
  return assigned;
}

// Whether a block ends by returning, so it hands back no state.
const returns = (block) => block?.statements.at(-1)?.kind === 'Return';

// Whether every path through an if returns.
function alwaysReturns(statement) {
  if (!returns(statement.then)) {
    return false;
  }
  const rest = statement.otherwise;
  return rest?.kind === 'If' ? alwaysReturns(rest) : returns(rest);
}

// How a state of the given variables is bound, received and handed back.
function stateSpellings(variables) {
  if (variables.length === 0) {
    return { binder: '', pattern: '_', value: 'tt' };
  }
  if (variables.length === 1) {
    const [only] = variables;
    return { binder: `${only} <- `, pattern: only, value: only };
  }
  const tuple = `(${variables.join(', ')})`;
  return { binder: `'${tuple} <- `, pattern: `'${tuple}`, value: tuple };
}

// Statements of an action.
const statementEmitter = (Base) =>
  class RocqStatementEmitter extends Base {
    constructor(syntax) {
      super(syntax);
      this.unit = '  ';
    }

    comment(text) {
      this.line(`(* ${text} *)`);
    }

    quote(value) {
      return `"${value.replace(/"/g, '""')}"`;
    }

    // Adds text to the last line written.
    append(text) {
      const last = this.lines.length - 1;
      this.lines[last] = mappedLine(
        this,
        `${this.lines[last]}${text}`,
        this.lines[last]
      );
    }

    // The statements of a block, one level deeper, and the state it hands
    // back unless it returns.
    action(block, value) {
      this.depth += 1;
      this.statements(block?.statements ?? []);
      if (!returns(block)) {
        this.line(`pure ${value}`);
      }
      this.depth -= 1;
    }

    // Statements of which a last return ends the action: no `;;` follows.
    statements(statements) {
      statements.forEach((statement, index) =>
        this.statement(
          index === statements.length - 1 && statement.kind === 'Return'
            ? { ...statement, final: true }
            : statement
        )
      );
    }

    statement(statement) {
      switch (statement.kind) {
        case 'Print':
          return this.line(
            `${statement.newline ? 'print_line' : 'print'} ${this.printed(statement.value)} ;;`
          );
        case 'Evaluate': {
          // A value nobody reads is bound to _.
          const { expression } = statement;
          return this.line(
            expression.type && expression.type !== 'nothing'
              ? `let _ := ${this.expression(expression)} in`
              : `call ${this.expression(expression, 8)} ;;`
          );
        }
        case 'Return':
          return this.line(
            `stop ${statement.value ? this.expression(statement.value, 8) : 'tt'}${statement.final ? '' : ' ;;'}`
          );
        case 'Declaration':
          return this.line(this.declaration(statement));
        case 'Assignment':
          return this.line(
            `let ${statement.name} := ${this.expression(statement.value)} in`
          );
        case 'IndexAssignment': {
          const { name: array, index, value } = statement;
          return this.line(
            `let ${array} := with_item ${array} ${this.expression(index, 8)} ${this.expression(value, 8)} in`
          );
        }
        case 'If':
          return this.ifStatement(statement);
        case 'While':
          return this.whileStatement(statement);
        case 'CountingLoop':
          return this.countingLoop(statement);
        default:
          return super.statement(statement);
      }
    }

    // A printed value is text: a literal, joined parts or a shown value.
    printed(value) {
      if (value.kind === 'Text') {
        return this.quote(value.value);
      }
      if (value.kind === 'Interpolation') {
        return this.expression(value, 8);
      }
      return `(show ${this.expression(value, 8)})`;
    }

    declaration(statement) {
      const { name: variable, value } = statement;
      const array = ['ArrayLiteral', 'NewArray'].includes(value?.kind);
      const type = array ? 'array' : (statement.type ?? 'integer');
      const initial = value ?? defaultValues[type] ?? defaultValues.integer;
      return `let ${variable} : ${this.type(type)} := ${this.expression(initial)} in`;
    }

    ifStatement(statement) {
      const state = stateSpellings(
        alwaysReturns(statement)
          ? []
          : assignedVariables({ statements: [statement] })
      );
      this.line(
        `${state.binder}(if ${this.expression(statement.condition)} then`
      );
      this.action(statement.then, state.value);
      let rest = statement.otherwise;
      while (rest?.kind === 'If') {
        this.line(`else if ${this.expression(rest.condition)} then`);
        this.action(rest.then, state.value);
        rest = rest.otherwise;
      }
      this.line('else');
      this.action(rest, state.value);
      this.append(') ;;');
    }

    whileStatement({ condition, body }) {
      const state = stateSpellings(assignedVariables(body));
      this.line(
        `${state.binder}loop_while (fun ${state.pattern} => ${this.expression(condition)}) (fun ${state.pattern} =>`
      );
      this.action(body, state.value);
      this.append(`) ${state.value} ;;`);
    }

    countingLoop({ variable, start, end, body }) {
      const state = stateSpellings(assignedVariables(body));
      this.line(
        `${state.binder}for_range ${this.expression(start, 8)} ${this.expression(end, 8)} (fun ${variable} ${state.pattern} =>`
      );
      this.action(body, state.value);
      this.append(`) ${state.value} ;;`);
    }
  };

// Expressions: applications, operators and lists.
const expressionEmitter = (Base) =>
  class RocqExpressionEmitter extends statementEmitter(Base) {
    // Applications bind tighter than every operator, and an argument that
    // is not a single word is parenthesized.
    applied(written, parent) {
      return parent > 6 ? `(${written})` : written;
    }

    application(callee, values, parent) {
      const written = values.length
        ? values.map((value) => this.expression(value, 8)).join(' ')
        : 'tt';
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
          return `[${expression.elements.map((element) => this.expression(element)).join('; ')}]`;
        case 'NewArray':
          return this.application(
            'filled',
            [expression.length, expression.fill],
            parent
          );
        case 'Index':
          return this.application(
            'item',
            [expression.array, expression.index],
            parent
          );
        case 'Length':
          return this.application('size', [expression.array], parent);
        default:
          return super.expression(expression, parent);
      }
    }

    // Rocq's && and || bind as tightly as + and *, and comparisons more
    // loosely, so an operand that is an operation keeps its parentheses.
    logical(expression, parent) {
      const operand = (part) =>
        part.kind === 'Binary'
          ? `(${this.expression(part)})`
          : this.expression(part);
      const written = `${operand(expression.left)} ${this.syntax.operators[expression.operator]} ${operand(expression.right)}`;
      return parent > 0 ? `(${written})` : written;
    }

    binary(expression, parent) {
      const { operator, left, right } = expression;
      // Rocq programs compute with integers only, so true division
      // truncates too.
      if (['divide', 'realDivide', 'remainder'].includes(operator)) {
        return this.application(
          operator === 'remainder' ? 'Z.rem' : 'Z.quot',
          [left, right],
          parent
        );
      }
      if (operator === 'and' || operator === 'or') {
        return this.logical(expression, parent);
      }
      if (operator === 'notEqual') {
        return this.applied(
          `negb (${this.binary({ ...expression, operator: 'equal' }, 0)})`,
          parent
        );
      }
      const spelled =
        comparisons[operator] ??
        (operator === 'equal' ? this.syntax.operators.equal : undefined);
      if (spelled) {
        const written = `${this.expression(left, 5)} ${spelled} ${this.expression(right, 5)}`;
        return parent > 0 ? `(${written})` : written;
      }
      return super.binary(expression, parent);
    }

    // "text " ++ show value: text joined with the shown values.
    interpolation(parts) {
      return parts
        .map((part) =>
          part.kind === 'Text'
            ? this.quote(part.value)
            : `show ${this.expression(part, 8)}`
        )
        .join(' ++ ');
    }
  };

const emitter = (Base) =>
  class RocqEmitter extends expressionEmitter(Base) {
    expression(expression, parent = 0) {
      if (expression.kind === 'Interpolation') {
        const written = this.interpolation(expression.parts);
        return parent > 0 ? `(${written})` : written;
      }
      return super.expression(expression, parent);
    }

    procedure(item) {
      return !item.returnType || item.returnType === 'nothing';
    }

    signature(item, first) {
      const parameters = item.parameters.length
        ? item.parameters
        : [{ name: 'no_arguments', type: 'nothing' }];
      const written = parameters
        .map(
          ({ name: parameter, type }) => `(${parameter} : ${this.type(type)})`
        )
        .join(' ');
      const opening = first ? 'Fixpoint' : 'with';
      const struct = `{struct ${parameters[0].name}}`;
      return this.procedure(item)
        ? `${opening} ${item.name} ${written} ${struct} : Action unit unit := (`
        : `${opening} ${item.name} ${written} ${struct} : ${this.type(item.returnType)} := value (`;
    }

    // The statements of a function body; the last one ends the action.
    functionBody(body, ending) {
      this.depth += 1;
      this.statements(body.statements);
      if (!returns(body)) {
        this.line(ending);
      }
      this.depth -= 1;
    }

    functionDefinition(item) {
      for (const text of item.comments ?? []) {
        this.comment(text);
      }
      const grouped = this.group?.includes(item);
      const first = !grouped || item === this.group[0];
      if (first) {
        this.line('#[bypass_check(guard)]');
      }
      this.line(this.signature(item, first));
      this.functionBody(
        item.body,
        this.procedure(item) ? 'pure tt' : 'stop default'
      );
      const last = !grouped || item === this.group.at(-1);
      this.append(last ? ').' : ')');
    }

    // Functions up to the last one called before its definition are one
    // group; the functions after it stand on their own.
    program(program) {
      const called = laterCalls(program.functions).at(-1);
      if (called) {
        this.group = program.functions.slice(
          0,
          program.functions.indexOf(called) + 1
        );
      }
      return `${this.syntax.header}\n${super.program(program)}`;
    }

    main(program) {
      for (const text of program.mainComments ?? []) {
        this.comment(text);
      }
      this.line('Definition main : Action unit unit := (');
      this.functionBody(program.main, 'pure tt');
      this.append(').');
      this.line();
      this.line('Eval vm_compute in run main.');
    }
  };

export const rocq = { parser, emitter };
