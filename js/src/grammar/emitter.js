// Emitter: renders a typed meta program in a target language. Every
// language-specific spelling comes from languages.js or from the small
// tables below; the structure of the output follows the meta tree.

import { add, number } from './meta.js';
import { languageSyntax } from './languages.js';

const precedence = {
  or: 1,
  and: 2,
  equal: 3,
  notEqual: 3,
  less: 4,
  lessOrEqual: 4,
  greater: 4,
  greaterOrEqual: 4,
  add: 5,
  subtract: 5,
  multiply: 6,
  divide: 6,
  remainder: 6,
};
const symbols = {
  add: '+',
  subtract: '-',
  multiply: '*',
  divide: '/',
  remainder: '%',
  less: '<',
  lessOrEqual: '<=',
  greater: '>',
  greaterOrEqual: '>=',
  equal: '==',
  notEqual: '!=',
};
const conditionParentheses = new Set([
  'c',
  'cpp',
  'csharp',
  'java',
  'javascript',
  'typescript',
  'kotlin',
  'php',
]);
const blockCommentLanguages = new Set(['c', 'csharp']);

class Emitter {
  constructor(syntax) {
    this.syntax = syntax;
    this.unit = syntax.id === 'go' ? '\t' : '    ';
    this.lines = [];
    this.depth = 0;
    this.uses = new Set();
  }

  line(content = '') {
    this.lines.push(content ? this.unit.repeat(this.depth) + content : '');
  }

  terminator() {
    return ['python', 'ruby', 'lua', 'go', 'kotlin', 'swift'].includes(
      this.syntax.id
    )
      ? ''
      : ';';
  }

  // ---- names, types, literals ----
  variable(identifier) {
    return this.syntax.variableSigil
      ? `${this.syntax.variableSigil}${identifier}`
      : identifier;
  }

  type(meta) {
    const types = this.syntax.types ?? {};
    if (meta === 'text' && this.syntax.id === 'cpp') {
      this.uses.add('string');
    }
    return types[meta] ?? types.integer;
  }

  escape(value, { format } = {}) {
    let result = value
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\t/g, '\\t')
      .replace(/\r/g, '\\r');
    if (['php', 'kotlin'].includes(this.syntax.id)) {
      result = result.replace(/\$/g, '\\$');
    }
    if (this.syntax.id === 'ruby') {
      result = result.replace(/#\{/g, '\\#{');
    }
    if (format === 'percent') {
      result = result.replace(/%/g, '%%');
    }
    if (format === 'braces') {
      result = result.replace(/\{/g, '{{').replace(/\}/g, '}}');
    }
    return result;
  }

  quote(value) {
    return `"${this.escape(value)}"`;
  }

  // ---- expressions ----
  unary(expression, parent) {
    const operator =
      expression.operator === 'not' ? this.syntax.operators.not : '-';
    const spaced = /\w$/.test(operator) ? `${operator} ` : operator;
    const result = `${spaced}${this.expression(expression.operand, 7)}`;
    return parent > 7 ? `(${result})` : result;
  }

  expression(expression, parent = 0) {
    switch (expression.kind) {
      case 'Number':
        return expression.value < 0 && parent > 6
          ? `(${expression.value})`
          : String(expression.value);
      case 'Text':
        return this.quote(expression.value);
      case 'Boolean':
        return (
          (this.syntax.words ?? {})[String(expression.value)] ??
          String(expression.value)
        );
      case 'Name':
        return this.variable(expression.name);
      case 'Interpolation':
        return this.interpolation(expression.parts);
      case 'Call':
        return `${expression.callee}(${expression.arguments.map((argument) => this.expression(argument)).join(', ')})`;
      case 'Unary':
        return this.unary(expression, parent);
      case 'Binary':
        return this.binary(expression, parent);
      default:
        throw new Error(`Cannot emit ${expression.kind} as an expression`);
    }
  }

  binary(expression, parent) {
    const level = precedence[expression.operator];
    const left = this.expression(expression.left, level);
    const right = this.expression(expression.right, level + 1);
    let result;
    if (expression.operator === 'divide') {
      const integer = this.syntax.operators.integerDivide;
      if (integer) {
        result = `${left} ${integer} ${right}`;
      } else if (
        this.syntax.id === 'javascript' ||
        this.syntax.id === 'typescript'
      ) {
        return `Math.trunc(${this.expression(expression.left)} / ${this.expression(expression.right)})`;
      } else if (this.syntax.id === 'php') {
        return `intdiv(${this.expression(expression.left)}, ${this.expression(expression.right)})`;
      } else {
        result = `${left} / ${right}`;
      }
    } else {
      const operator =
        this.syntax.operators[expression.operator] ??
        symbols[expression.operator];
      result = `${left} ${operator} ${right}`;
    }
    return level < parent ? `(${result})` : result;
  }

  // Text built from literal and computed parts, outside of output calls.
  interpolation(parts) {
    const render = (open, close, escapeOptions) =>
      `"${parts.map((part) => (part.kind === 'Text' ? this.escape(part.value, escapeOptions) : `${open}${this.expression(part)}${close}`)).join('')}"`;
    switch (this.syntax.id) {
      case 'javascript':
      case 'typescript':
        return `\`${parts.map((part) => (part.kind === 'Text' ? part.value.replace(/[`\\]/g, '\\$&').replace(/\$\{/g, '\\${').replace(/\n/g, '\\n') : `\${${this.expression(part)}}`)).join('')}\``;
      case 'python':
        return `f${render('{', '}', { format: 'braces' })}`;
      case 'csharp':
        return `$${render('{', '}', { format: 'braces' })}`;
      case 'ruby':
        return render('#{', '}');
      case 'kotlin':
        return render('${', '}');
      case 'php':
        // PHP interpolates only variables, so computed parts are concatenated.
        return parts
          .map((part) =>
            part.kind === 'Text'
              ? this.quote(part.value)
              : this.expression(part, 6)
          )
          .join(' . ');
      case 'swift':
        return render('\\(', ')');
      case 'rust':
        return `format!(${this.formatArguments(parts, 'braces')})`;
      case 'go':
        this.uses.add('fmt');
        return `fmt.Sprintf(${this.formatArguments(parts, 'percent')})`;
      case 'lua':
        return parts
          .map((part) =>
            part.kind === 'Text'
              ? this.quote(part.value)
              : this.expression(part, 6)
          )
          .join(' .. ');
      case 'cpp':
        this.uses.add('string');
        return parts
          .map((part, index) =>
            part.kind === 'Text'
              ? index === 0
                ? `std::string(${this.quote(part.value)})`
                : this.quote(part.value)
              : part.type === 'text'
                ? this.expression(part, 6)
                : `std::to_string(${this.expression(part)})`
          )
          .join(' + ');
      case 'java': {
        const pieces = parts.map((part) =>
          part.kind === 'Text'
            ? this.quote(part.value)
            : this.expression(part, 6)
        );
        return parts[0].kind === 'Text'
          ? pieces.join(' + ')
          : ['""', ...pieces].join(' + ');
      }
      default:
        throw new Error(
          `${this.syntax.label} has no text interpolation in this translator`
        );
    }
  }

  // "format string", value, value  — for printf-like and format!-like calls.
  formatArguments(parts, style) {
    const placeholders = { integer: '%d', text: '%s', boolean: '%d' };
    if (this.syntax.id === 'go') {
      placeholders.boolean = '%t';
    }
    const format = parts
      .map((part) =>
        part.kind === 'Text'
          ? this.escape(part.value, { format: style })
          : style === 'braces'
            ? '{}'
            : (placeholders[part.type] ?? '%d')
      )
      .join('');
    const values = parts
      .filter((part) => part.kind !== 'Text')
      .map((part) => this.expression(part));
    return [`"${format}"`, ...values].join(', ');
  }

  // ---- statements ----
  print({ value, newline }) {
    const printer = printers[this.syntax.id];
    if (!printer) {
      throw new Error(`No output procedure for ${this.syntax.label}`);
    }
    const parts = value.kind === 'Interpolation' ? value.parts : [value];
    return printer(this, {
      value,
      newline,
      parts,
      lineParts: newline ? [...parts, { kind: 'Text', value: '\n' }] : parts,
      single: () => this.expression(value),
    });
  }

  interpolationOrText(parts) {
    const merged = parts.reduce((result, part) => {
      if (part.kind === 'Text' && result.at(-1)?.kind === 'Text') {
        return [
          ...result.slice(0, -1),
          { kind: 'Text', value: result.at(-1).value + part.value },
        ];
      }
      return [...result, part];
    }, []);
    return merged.length === 1 && merged[0].kind === 'Text'
      ? this.quote(merged[0].value)
      : this.interpolation(merged);
  }

  comment(text) {
    if (blockCommentLanguages.has(this.syntax.id)) {
      this.line(`/* ${text} */`);
    } else {
      this.line(`${this.syntax.lineComment} ${text}`);
    }
  }

  condition(expression) {
    const value = this.expression(expression);
    return conditionParentheses.has(this.syntax.id) ? `(${value})` : value;
  }

  openBlock(header) {
    switch (this.syntax.blocks) {
      case 'braces':
        this.line(`${header} {`);
        break;
      case 'indentation':
        this.line(`${header}:`);
        break;
      default:
        this.line(header);
    }
    this.depth += 1;
  }

  closeBlock() {
    this.depth -= 1;
    if (this.syntax.blocks === 'braces') {
      this.line('}');
    }
    if (this.syntax.blocks === 'end') {
      this.line('end');
    }
  }

  body(block) {
    if (block.statements.length === 0 && this.syntax.blocks === 'indentation') {
      this.line('pass');
    }
    for (const statement of block.statements) {
      this.statement(statement);
    }
  }

  statement(statement) {
    const end = this.terminator();
    switch (statement.kind) {
      case 'Comment':
        return this.comment(statement.text);
      case 'Print':
        return this.line(this.print(statement));
      case 'Evaluate':
        return this.line(`${this.expression(statement.expression)}${end}`);
      case 'Return':
        return this.line(
          statement.value
            ? `return ${this.expression(statement.value)}${end}`
            : `return${end}`
        );
      case 'Declaration':
        return this.line(this.declaration(statement));
      case 'Assignment':
        return this.line(this.assignment(statement));
      case 'If':
        return this.ifStatement(statement);
      case 'While':
        return this.whileStatement(statement);
      case 'CountingLoop':
        return this.countingLoop(statement);
      default:
        throw new Error(`Cannot emit ${statement.kind} as a statement`);
    }
  }

  declaration({ name, type, value, mutable }) {
    const initial = value ? this.expression(value) : this.expression(number(0));
    const declare = declarers[this.syntax.id] ?? declarers.typedPrefix;
    return declare(this, { name, type, mutable, initial });
  }

  // The meta language only knows `x = value`; `x = x + 1` is written back
  // as `x += 1` in every language that has compound assignment.
  assignment({ name: identifier, value }) {
    const target = this.variable(identifier);
    const compound = compoundOperators[value.operator];
    if (
      compound &&
      this.syntax.id !== 'lua' &&
      value.kind === 'Binary' &&
      value.left.kind === 'Name' &&
      value.left.name === identifier
    ) {
      return `${target} ${compound} ${this.expression(value.right)}${this.terminator()}`;
    }
    return `${target} = ${this.expression(value)}${this.terminator()}`;
  }

  ifStatement(statement) {
    const then = this.syntax.id === 'lua' ? ' then' : '';
    this.openBlock(`if ${this.condition(statement.condition)}${then}`);
    this.body(statement.then);
    let otherwise = statement.otherwise;
    // else-if chains stay flat in every language.
    while (otherwise?.kind === 'If') {
      this.depth -= 1;
      this.line(this.elseIfHeader(otherwise.condition));
      this.depth += 1;
      this.body(otherwise.then);
      otherwise = otherwise.otherwise;
    }
    if (otherwise) {
      this.depth -= 1;
      this.line(
        { braces: '} else {', indentation: 'else:', end: 'else' }[
          this.syntax.blocks
        ]
      );
      this.depth += 1;
      this.body(otherwise);
    }
    this.closeBlock();
  }

  elseIfHeader(expression) {
    const condition = this.condition(expression);
    if (this.syntax.blocks === 'braces') {
      return `} else if ${condition} {`;
    }
    if (this.syntax.id === 'python') {
      return `elif ${condition}:`;
    }
    if (this.syntax.id === 'lua') {
      return `elseif ${condition} then`;
    }
    return `${this.syntax.elseIf} ${condition}`;
  }

  whileStatement(statement) {
    const condition = this.condition(statement.condition);
    const header =
      this.syntax.id === 'go'
        ? `for ${condition}`
        : this.syntax.id === 'lua'
          ? `while ${condition} do`
          : `while ${condition}`;
    this.openBlock(header);
    this.body(statement.body);
    this.closeBlock();
  }

  countingLoop({ variable: identifier, start, end, body }) {
    const from = this.expression(start);
    const to = this.expression(end, 5);
    const target = this.variable(identifier);
    const headers = {
      c: `for (int ${identifier} = ${from}; ${identifier} < ${to}; ${identifier}++)`,
      cpp: `for (int ${identifier} = ${from}; ${identifier} < ${to}; ${identifier}++)`,
      csharp: `for (int ${identifier} = ${from}; ${identifier} < ${to}; ${identifier}++)`,
      java: `for (int ${identifier} = ${from}; ${identifier} < ${to}; ${identifier}++)`,
      javascript: `for (let ${identifier} = ${from}; ${identifier} < ${to}; ${identifier}++)`,
      typescript: `for (let ${identifier} = ${from}; ${identifier} < ${to}; ${identifier}++)`,
      php: `for (${target} = ${from}; ${target} < ${to}; ${target}++)`,
      go: `for ${identifier} := ${from}; ${identifier} < ${to}; ${identifier}++`,
      python:
        start.kind === 'Number' && start.value === 0
          ? `for ${identifier} in range(${this.expression(end)})`
          : `for ${identifier} in range(${from}, ${this.expression(end)})`,
      ruby: `for ${identifier} in ${from}...${to}`,
      lua: `for ${identifier} = ${from}, ${this.expression(add(end, number(-1)))} do`,
      rust: `for ${identifier} in ${from}..${to}`,
      kotlin: `for (${identifier} in ${from} until ${to})`,
      swift: `for ${identifier} in ${from}..<${to}`,
    };
    this.openBlock(headers[this.syntax.id]);
    this.body(body);
    this.closeBlock();
  }

  // ---- functions and program ----
  signature(item) {
    const write = signatures[this.syntax.id] ?? signatures.typedPrefix;
    const typed = (render) =>
      item.parameters
        .map((parameter) => render(parameter.name, this.type(parameter.type)))
        .join(', ');
    const names = item.parameters.map((parameter) => parameter.name).join(', ');
    const returns = item.returnType;
    const after = (arrow) =>
      returns === 'nothing' ? '' : `${arrow}${this.type(returns)}`;
    return write({
      name: item.name,
      typed,
      names,
      after,
      returns: this.type(returns),
    });
  }

  functionDefinition(item) {
    for (const text of item.comments ?? []) {
      this.comment(text);
    }
    this.openBlock(this.signature(item));
    this.body(item.body);
    this.closeBlock();
  }

  mainHeader() {
    return {
      c: 'int main(void)',
      cpp: 'int main()',
      go: 'func main()',
      rust: 'fn main()',
      kotlin: 'fun main()',
      csharp: 'static void Main()',
      java: 'public static void main(String[] args)',
    }[this.syntax.id];
  }

  program(program) {
    const insideClass = this.syntax.entryPoint === 'class-method';
    if (insideClass) {
      this.openBlock(
        this.syntax.id === 'csharp' ? 'class Program' : 'class Main'
      );
    }
    for (const item of program.functions) {
      this.functionDefinition(item);
      this.line();
    }
    const header = this.mainHeader();
    if (header) {
      for (const text of program.mainComments ?? []) {
        this.comment(text);
      }
      this.openBlock(header);
      this.body(program.main);
      this.closeBlock();
    } else {
      for (const text of program.mainComments ?? []) {
        this.comment(text);
      }
      this.body(program.main);
    }
    if (insideClass) {
      this.closeBlock();
    }
    while (this.lines.at(-1) === '') {
      this.lines.pop();
    }
    const body = this.lines;
    this.lines = [];
    // File comments come first, except where a header must open the file.
    if (this.syntax.id === 'php') {
      this.lines.push('<?php', '');
    }
    for (const text of program.comments) {
      this.comment(text);
    }
    if (program.comments.length) {
      this.line();
    }
    return `${[...this.lines, ...this.prelude(program), ...body].join('\n')}\n`;
  }

  prelude(program) {
    const lines = [];
    if (this.syntax.id === 'go') {
      lines.push('package main', '');
    }
    lines.push(...(program.libraryImports ?? []));
    if (this.uses.has('stdio')) {
      lines.push('#include <stdio.h>');
    }
    if (this.uses.has('iostream')) {
      lines.push('#include <iostream>');
    }
    if (this.uses.has('string')) {
      lines.push('#include <string>');
    }
    if (this.uses.has('fmt')) {
      lines.push('import "fmt"');
    }
    if (lines.length && lines.at(-1) !== '') {
      lines.push('');
    }
    return lines;
  }
}

const compoundOperators = {
  add: '+=',
  subtract: '-=',
  multiply: '*=',
  divide: '/=',
  remainder: '%=',
};

export function emitProgram(program, languageId) {
  return new Emitter(languageSyntax(languageId)).program(program);
}

// How each language writes a value to standard output. C, Go and Rust use
// format strings, so the value is rendered only where it is needed.
const printers = {
  javascript: (emitter, { value, newline, single }) =>
    newline
      ? `console.log(${single()});`
      : `process.stdout.write(${value.type === 'text' ? single() : `String(${single()})`});`,
  python: (emitter, { newline, single }) =>
    newline ? `print(${single()})` : `print(${single()}, end="")`,
  ruby: (emitter, { newline, single }) =>
    `${newline ? 'puts' : 'print'} ${single()}`,
  lua: (emitter, { newline, single }) =>
    newline ? `print(${single()})` : `io.write(${single()})`,
  php: (emitter, { lineParts }) =>
    `echo ${emitter.interpolationOrText(lineParts)};`,
  c: (emitter, { lineParts }) => {
    emitter.uses.add('stdio');
    return `printf(${emitter.formatArguments(lineParts, 'percent')});`;
  },
  cpp: (emitter, { parts, newline }) => {
    emitter.uses.add('iostream');
    return `std::cout << ${parts.map((part) => emitter.expression(part, 6)).join(' << ')}${newline ? ' << std::endl' : ''};`;
  },
  go: (emitter, { parts, lineParts, newline, single }) => {
    emitter.uses.add('fmt');
    return parts.length === 1
      ? `fmt.${newline ? 'Println' : 'Print'}(${single()})`
      : `fmt.Printf(${emitter.formatArguments(lineParts, 'percent')})`;
  },
  rust: (emitter, { parts, newline }) =>
    `${newline ? 'println!' : 'print!'}(${emitter.formatArguments(parts, 'braces')});`,
  csharp: (emitter, { newline, single }) =>
    `System.Console.${newline ? 'WriteLine' : 'Write'}(${single()});`,
  java: (emitter, { newline, single }) =>
    `System.out.${newline ? 'println' : 'print'}(${single()});`,
  kotlin: (emitter, { newline, single }) =>
    `${newline ? 'println' : 'print'}(${single()})`,
  swift: (emitter, { newline, single }) =>
    newline ? `print(${single()})` : `print(${single()}, terminator: "")`,
};
printers.typescript = printers.javascript;

// How each language declares a local variable.
const declarers = {
  javascript: (emitter, { name, mutable, initial }) =>
    `${mutable ? 'let' : 'const'} ${name} = ${initial};`,
  python: (emitter, { name, initial }) => `${name} = ${initial}`,
  php: (emitter, { name, initial }) => `$${name} = ${initial};`,
  lua: (emitter, { name, initial }) => `local ${name} = ${initial}`,
  go: (emitter, { name, initial }) => `${name} := ${initial}`,
  rust: (emitter, { name, type, mutable, initial }) =>
    `let ${mutable ? 'mut ' : ''}${name}${type === 'integer' ? ': i64' : ''} = ${initial};`,
  kotlin: (emitter, { name, mutable, initial }) =>
    `${mutable ? 'var' : 'val'} ${name} = ${initial}${emitter.terminator()}`,
  swift: (emitter, { name, mutable, initial }) =>
    `${mutable ? 'var' : 'let'} ${name} = ${initial}`,
  typedPrefix: (emitter, { name, type, initial }) =>
    `${emitter.type(type)} ${name} = ${initial};`,
};
declarers.typescript = declarers.javascript;
declarers.ruby = declarers.python;

// How each language writes a function head.
const signatures = {
  javascript: ({ name, names }) => `function ${name}(${names})`,
  typescript: ({ name, typed, returns }) =>
    `function ${name}(${typed((id, type) => `${id}: ${type}`)}): ${returns}`,
  python: ({ name, names }) => `def ${name}(${names})`,
  lua: ({ name, names }) => `local function ${name}(${names})`,
  php: ({ name, typed }) => `function ${name}(${typed((id) => `$${id}`)})`,
  go: ({ name, typed, after }) =>
    `func ${name}(${typed((id, type) => `${id} ${type}`)})${after(' ')}`,
  rust: ({ name, typed, after }) =>
    `fn ${name}(${typed((id, type) => `${id}: ${type}`)})${after(' -> ')}`,
  kotlin: ({ name, typed, after }) =>
    `fun ${name}(${typed((id, type) => `${id}: ${type}`)})${after(': ')}`,
  swift: ({ name, typed, after }) =>
    `func ${name}(${typed((id, type) => `_ ${id}: ${type}`)})${after(' -> ')}`,
  csharp: ({ name, typed, returns }) =>
    `static ${returns} ${name}(${typed((id, type) => `${type} ${id}`)})`,
  typedPrefix: ({ name, typed, returns }) =>
    `${returns} ${name}(${typed((id, type) => `${type} ${id}`)})`,
};
signatures.ruby = signatures.python;
signatures.java = signatures.csharp;
