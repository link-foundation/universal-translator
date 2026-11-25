// Emitter: renders a typed meta program in a target language. Every
// language-specific spelling comes from languages.js or from the small
// tables below; the structure of the output follows the meta tree.

import { add, block, laterCalls, name, node, number } from './meta.js';
import { languageSyntax } from './languages.js';
import { dialects } from './dialects/index.js';
import { withArrays } from './array-spellings.js';

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
  'perl',
  'dart',
  'scala',
  'r',
  'groovy',
  'd',
]);
const withoutTerminator = new Set([
  'python',
  'nim',
  'ruby',
  'lua',
  'go',
  'kotlin',
  'swift',
  'scala',
  'julia',
  'r',
  'groovy',
]);
const blockCommentLanguages = new Set(['c', 'csharp']);

class BaseEmitter {
  constructor(syntax) {
    this.syntax = syntax;
    // A dialect such as Objective-C is written with the tables of the
    // language family it extends (C), plus its own differences.
    this.id = syntax.family ?? syntax.id;
    this.unit = syntax.id === 'go' ? '\t' : '    ';
    this.lines = [];
    this.depth = 0;
    this.uses = new Set();
  }

  line(content = '') {
    this.lines.push(content ? this.unit.repeat(this.depth) + content : '');
  }

  terminator() {
    return withoutTerminator.has(this.id) ? '' : ';';
  }

  // ---- names, types, literals ----
  variable(identifier) {
    return this.syntax.variableSigil
      ? `${this.syntax.variableSigil}${identifier}`
      : identifier;
  }

  type(meta) {
    const types = this.syntax.types ?? {};
    if (meta === 'text' && this.id === 'cpp') {
      this.uses.add('string');
    }
    if (meta === 'boolean' && this.syntax.id === 'objc') {
      this.uses.add('objc');
    } else if (meta === 'boolean' && this.id === 'c') {
      this.uses.add('stdbool');
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
    // Characters that would start an embedded variable, such as $ in PHP.
    for (const sigil of this.syntax.escapeSigils ?? []) {
      result = result.replaceAll(sigil, `\\${sigil}`);
    }
    if (this.id === 'ruby') {
      result = result.replace(/#\{/g, '\\#{');
    }
    if (format === 'percent') {
      result = result.replace(/%/g, '%%');
    }
    if (format === 'dollar') {
      result = result.replaceAll('$', '$$$$');
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
        return this.number(expression, parent);
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

  number({ value }, parent) {
    // R needs a suffix to keep integers integral: 1L.
    const suffix = Number.isInteger(value)
      ? (this.syntax.numberSuffix ?? '')
      : '';
    const written = `${value}${suffix}`;
    return value < 0 && parent > 6 ? `(${written})` : written;
  }

  binary(expression, parent) {
    const level = precedence[expression.operator];
    // R's %% and %/% bind tighter than * and /, so their operands that are
    // themselves operations keep parentheses.
    const tight =
      this.id === 'r' && ['divide', 'remainder'].includes(expression.operator);
    // `a && b || c` keeps its meaning without parentheses, but readers (and
    // C compilers with -Wparentheses) expect them around the inner "and".
    const inner = expression.operator === 'or' ? precedence.and + 1 : level;
    const left = this.expression(expression.left, tight ? 7 : inner);
    const right = this.expression(
      expression.right,
      tight ? 7 : Math.max(inner, level + 1)
    );
    let result;
    if (expression.operator === 'divide') {
      const integer = this.syntax.operators.integerDivide;
      const spelling = this.syntax.integerDivision;
      const whole = (part) => this.expression(part);
      if (integer) {
        result = `${left} ${integer} ${right}`;
      } else if (spelling?.wrapper) {
        return `${spelling.wrapper}(${whole(expression.left)} / ${whole(expression.right)})`;
      } else if (spelling?.call) {
        return `${spelling.call}(${whole(expression.left)}, ${whole(expression.right)})`;
      } else if (spelling?.method) {
        return `${this.expression(expression.left, 8)}.${spelling.method}(${whole(expression.right)})`;
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
    const delimited = embeddings[this.id];
    if (delimited) {
      const { prefix = '', open, close, format } = delimited;
      if (this.id === 'nim') {
        this.uses.add('strformat');
      }
      return `${prefix}"${parts.map((part) => (part.kind === 'Text' ? this.escape(part.value, { format }) : `${open}${this.expression(part)}${close}`)).join('')}"`;
    }
    switch (this.id) {
      case 'javascript':
      case 'typescript':
        return `\`${parts.map((part) => (part.kind === 'Text' ? part.value.replace(/[`\\]/g, '\\$&').replace(/\$\{/g, '\\${').replace(/\n/g, '\\n') : `\${${this.expression(part)}}`)).join('')}\``;
      case 'r':
        return `paste0(${parts.map((part) => this.expression(part)).join(', ')})`;
      case 'php':
      case 'perl':
        // PHP and Perl interpolate only variables, so computed parts are
        // concatenated.
        return parts
          .map((part) =>
            part.kind === 'Text'
              ? this.quote(part.value)
              : this.expression(part, 6)
          )
          .join(' . ');
      case 'd':
        this.uses.add('std.conv');
        return `text(${parts.map((part) => this.expression(part)).join(', ')})`;
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
    if (this.id === 'go') {
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
    const printer = printers[this.id];
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
    const merged = mergeTexts(parts);
    return merged.length === 1 && merged[0].kind === 'Text'
      ? this.quote(merged[0].value)
      : this.interpolation(merged);
  }

  comment(text) {
    if (blockCommentLanguages.has(this.id)) {
      this.line(`/* ${text} */`);
    } else {
      this.line(`${this.syntax.lineComment} ${text}`);
    }
  }

  returnStatement({ value }) {
    const end = this.terminator();
    // R's return is a function: a bare `return` would not leave.
    if (!value) {
      return this.id === 'r' ? 'return(invisible())' : `return${end}`;
    }
    return this.id === 'r'
      ? `return(${this.expression(value)})`
      : `return ${this.expression(value)}${end}`;
  }

  condition(expression) {
    const value = this.expression(expression);
    return conditionParentheses.has(this.id) ? `(${value})` : value;
  }

  openBlock(header) {
    switch (this.syntax.blocks) {
      case 'braces':
        this.line(`${header} {`);
        break;
      case 'indentation':
        // Nim's procedure heads end with "=" instead of ":".
        this.line(header.endsWith('=') ? header : `${header}:`);
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
      this.line(this.syntax.emptyStatement ?? 'pass');
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
        return this.line(this.returnStatement(statement));
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
    const declare = declarers[this.id] ?? declarers.typedPrefix;
    return declare(this, { name, type, mutable, initial });
  }

  // The meta language only knows `x = value`; `x = x + 1` is written back
  // as `x += 1` in every language that has compound assignment.
  assignment({ name: identifier, value }) {
    const target = this.variable(identifier);
    const compound = compoundOperators[value.operator];
    // Languages that spell integer division as a call or a wrapper, or with
    // an operator of its own, would lose the truncation with `/=`.
    const plainDivision =
      value.operator !== 'divide' ||
      !(this.syntax.integerDivision || this.syntax.operators.integerDivide);
    if (
      compound &&
      plainDivision &&
      this.syntax.compoundAssignment !== false &&
      value.kind === 'Binary' &&
      value.left.kind === 'Name' &&
      value.left.name === identifier
    ) {
      return `${target} ${compound} ${this.expression(value.right)}${this.terminator()}`;
    }
    return `${target} ${this.syntax.assignment ?? '='} ${this.expression(value)}${this.terminator()}`;
  }

  ifStatement(statement) {
    const then = this.id === 'lua' ? ' then' : '';
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
      return `} ${this.syntax.bracedElseIf ?? 'else if'} ${condition} {`;
    }
    if (this.syntax.blocks === 'indentation') {
      return `${this.syntax.elseIf ?? 'elif'} ${condition}:`;
    }
    if (this.id === 'lua') {
      return `elseif ${condition} then`;
    }
    return `${this.syntax.elseIf} ${condition}`;
  }

  whileStatement(statement) {
    const condition = this.condition(statement.condition);
    const header =
      this.id === 'go'
        ? `for ${condition}`
        : this.id === 'lua'
          ? `while ${condition} do`
          : `while ${condition}`;
    this.openBlock(header);
    this.body(statement.body);
    this.closeBlock();
  }

  countingLoop(loop) {
    const { variable: identifier, start, end, body } = loop;
    if (this.id === 'r' && !isLiteralRange(start, end)) {
      return this.countingWhile(loop);
    }
    const from = this.expression(start);
    const last = this.expression(add(end, number(-1)), 5);
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
      perl: `for my ${target} (${from} .. ${last})`,
      dart: `for (var ${identifier} = ${from}; ${identifier} < ${to}; ${identifier}++)`,
      // A Long start makes the range Long, so a Long end fits.
      scala: `for (${identifier} <- ${start.kind === 'Number' ? `${from}${this.syntax.longSuffix}` : from} until ${to})`,
      julia: `for ${identifier} in ${from}:${last}`,
      r: `for (${identifier} in ${from}:${last})`,
      groovy: `for (${identifier} in ${from}..<${to})`,
      nim: `for ${identifier} in ${from} ..< ${to}`,
      d: `for (long ${identifier} = ${from}; ${identifier} < ${to}; ${identifier}++)`,
    };
    this.openBlock(headers[this.id]);
    this.body(body);
    this.closeBlock();
  }

  // R's a:b counts down when b < a, so a range that may be empty becomes
  // a while loop.
  countingWhile({ variable: identifier, start, end, body }) {
    const counter = name(identifier);
    this.statement(
      node('Declaration', { name: identifier, value: start, mutable: true })
    );
    this.whileStatement({
      condition: node('Binary', {
        operator: 'less',
        left: counter,
        right: end,
      }),
      body: block([
        ...body.statements,
        node('Assignment', {
          name: identifier,
          operator: '=',
          value: add(counter, number(1)),
        }),
      ]),
    });
  }

  // ---- functions and program ----
  signature(item) {
    const write = signatures[this.id] ?? signatures.typedPrefix;
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

  // `int male(int index);` in C, `proc male(index: int): int` in Nim and
  // `local male` in Lua.
  forwardDeclaration(item) {
    switch (this.syntax.forwardDeclarations) {
      case 'local':
        return `local ${item.name}`;
      case 'heading':
        return this.signature(item).replace(/\s*=$/, '');
      default:
        return `${this.signature(item)};`;
    }
  }

  // Lua defines a function it declared ahead without "local", which would
  // declare a second variable.
  definitionHeading(item) {
    const heading = this.signature(item);
    return this.syntax.forwardDeclarations === 'local' &&
      this.announced?.has(item.name)
      ? heading.replace(/^local /, '')
      : heading;
  }

  functionDefinition(item) {
    for (const text of item.comments ?? []) {
      this.comment(text);
    }
    this.openBlock(this.definitionHeading(item));
    // Perl receives its arguments in @_.
    if (this.syntax.parameters === 'unpacked' && item.parameters.length) {
      const names = item.parameters.map(({ name: id }) => this.variable(id));
      this.line(`my (${names.join(', ')}) = @_;`);
    }
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
      dart: 'void main()',
      scala: 'def main(args: Array[String]): Unit =',
      julia: 'function main()',
      d: 'void main()',
    }[this.id];
  }

  program(program) {
    const insideClass = this.syntax.entryPoint === 'class-method';
    if (insideClass) {
      this.openBlock(
        this.syntax.container ??
          (this.id === 'csharp' ? 'class Program' : 'class Main')
      );
    }
    // C, Pascal and Ada read from top to bottom, so a function called
    // before its definition is announced by a prototype.
    if (this.syntax.forwardDeclarations) {
      const announced = laterCalls(program.functions);
      this.announced = new Set(announced.map((item) => item.name));
      for (const item of announced) {
        this.line(this.forwardDeclaration(item));
      }
      if (announced.length) {
        this.line();
      }
    }
    for (const item of program.functions) {
      this.functionDefinition(item);
      this.line();
    }
    this.main(program);
    if (insideClass) {
      this.closeBlock();
    }
    while (this.lines.at(-1) === '') {
      this.lines.pop();
    }
    const body = this.lines;
    this.lines = [];
    // File comments come first, except where a header must open the file.
    if (this.id === 'php') {
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

  // The top-level statements, in a main procedure where the language has one.
  main(program) {
    for (const text of program.mainComments ?? []) {
      this.comment(text);
    }
    const header = this.mainHeader();
    if (!header) {
      this.body(program.main);
      return;
    }
    this.openBlock(header);
    this.body(program.main);
    this.closeBlock();
    // Julia calls its main function itself.
    if (this.syntax.callMain) {
      this.line();
      this.line(this.syntax.callMain);
    }
  }

  prelude(program) {
    const lines = [];
    if (this.id === 'go') {
      lines.push('package main', '');
    }
    lines.push(...(this.syntax.prelude ?? []));
    if (this.uses.has('strformat')) {
      lines.push('import std/strformat');
    }
    if (this.uses.has('std.conv')) {
      lines.push('import std.conv;');
    }
    if (this.uses.has('dart:io')) {
      lines.push("import 'dart:io';");
    }
    lines.push(...(program.libraryImports ?? []));
    if (this.uses.has('objc')) {
      lines.push('#import <objc/objc.h>');
    }
    if (this.uses.has('stdbool')) {
      lines.push('#include <stdbool.h>');
    }
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
    // Objective-C includes each header once with #import.
    return this.syntax.id === 'objc'
      ? lines.map((line) => line.replace(/^#include\b/, '#import'))
      : lines;
  }
}

// Languages that embed expressions in a double-quoted literal between two
// delimiters, with the prefix that marks such a literal.
const dollarBraces = { open: '${', close: '}' };
const embeddings = {
  python: { prefix: 'f', open: '{', close: '}', format: 'braces' },
  csharp: { prefix: '$', open: '{', close: '}', format: 'braces' },
  ruby: { open: '#{', close: '}' },
  kotlin: dollarBraces,
  dart: dollarBraces,
  groovy: dollarBraces,
  scala: { ...dollarBraces, prefix: 's', format: 'dollar' },
  julia: { open: '$(', close: ')' },
  swift: { open: '\\(', close: ')' },
  nim: { prefix: 'fmt', open: '{', close: '}', format: 'braces' },
};

function mergeTexts(parts) {
  return parts.reduce((result, part) => {
    if (part.kind === 'Text' && result.at(-1)?.kind === 'Text') {
      return [
        ...result.slice(0, -1),
        { kind: 'Text', value: result.at(-1).value + part.value },
      ];
    }
    return [...result, part];
  }, []);
}

const isLiteralRange = (start, end) =>
  start.kind === 'Number' && end.kind === 'Number' && start.value < end.value;

const compoundOperators = {
  add: '+=',
  subtract: '-=',
  multiply: '*=',
  divide: '/=',
  remainder: '%=',
};

// Arrays are written by a mixin of their own, which the dialects inherit.
const Emitter = withArrays(BaseEmitter);

export function emitProgram(program, languageId) {
  const LanguageEmitter = emitterFor(languageId);
  return new LanguageEmitter(languageSyntax(languageId)).program(program);
}

// Languages with a program layout of their own (Fortran, Pascal, Ada,
// Visual Basic, Bash, MATLAB, Zig) extend the shared emitter in dialects/.
const dialectEmitters = new Map();
function emitterFor(languageId) {
  const extend = dialects[languageId]?.emitter;
  if (!extend) {
    return Emitter;
  }
  if (!dialectEmitters.has(languageId)) {
    dialectEmitters.set(languageId, extend(Emitter));
  }
  return dialectEmitters.get(languageId);
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
  perl: (emitter, { lineParts }) =>
    `print ${emitter.interpolationOrText(lineParts)};`,
  dart: (emitter, { newline, single }) => {
    if (newline) {
      return `print(${single()});`;
    }
    emitter.uses.add('dart:io');
    return `stdout.write(${single()});`;
  },
  julia: (emitter, { newline, single }) =>
    `${newline ? 'println' : 'print'}(${single()})`,
  r: (emitter, { lineParts }) =>
    `cat(${mergeTexts(lineParts)
      .map((part) => emitter.expression(part))
      .join(', ')}, sep = "")`,
};
printers.nim = (emitter, { parts, newline }) =>
  `${newline ? 'echo ' : 'stdout.write('}${parts.map((part) => emitter.expression(part)).join(', ')}${newline ? '' : ')'}`;
printers.d = (emitter, { parts, newline }) =>
  `${newline ? 'writeln' : 'write'}(${parts.map((part) => emitter.expression(part)).join(', ')});`;
printers.typescript = printers.javascript;
printers.scala = printers.kotlin;
printers.groovy = printers.kotlin;

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
  perl: (emitter, { name, initial }) =>
    `my ${emitter.variable(name)} = ${initial};`,
  dart: (emitter, { name, mutable, initial }) =>
    `${mutable ? 'var' : 'final'} ${name} = ${initial};`,
  scala: (emitter, { name, type, mutable, initial }) =>
    `${mutable ? 'var' : 'val'} ${name}: ${emitter.type(type)} = ${initial}`,
  r: (emitter, { name, initial }) => `${name} <- ${initial}`,
  nim: (emitter, { name, mutable, initial }) =>
    `${mutable ? 'var' : 'let'} ${name} = ${initial}`,
  typedPrefix: (emitter, { name, type, initial }) =>
    `${emitter.type(type)} ${name} = ${initial}${emitter.terminator()}`,
};
declarers.typescript = declarers.javascript;
declarers.ruby = declarers.python;
declarers.julia = declarers.python;

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
  perl: ({ name }) => `sub ${name}`,
  scala: ({ name, typed, returns }) =>
    `def ${name}(${typed((id, type) => `${id}: ${type}`)}): ${returns} =`,
  julia: ({ name, names }) => `function ${name}(${names})`,
  r: ({ name, names }) => `${name} <- function(${names})`,
  nim: ({ name, typed, after }) =>
    `proc ${name}(${typed((id, type) => `${id}: ${type}`)})${after(': ')} =`,
  typedPrefix: ({ name, typed, returns }) =>
    `${returns} ${name}(${typed((id, type) => `${type} ${id}`)})`,
};
signatures.ruby = signatures.python;
signatures.java = signatures.csharp;
