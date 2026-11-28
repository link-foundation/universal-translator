// Emitter: renders a typed meta program in a target language. Every
// language-specific spelling comes from languages.js or from the small
// tables below; the structure of the output follows the meta tree.

import {
  add,
  block,
  laterCalls,
  layout,
  name,
  node,
  number,
} from '../meta/tree.js';
import { languageSyntax } from './languages.js';
import { splitVersion } from './versions.js';
import { dialects } from './dialects/index.js';
import { objectiveCRuntimeHeader } from './dialects/objc.js';
import { cppFileItems, nativeImportKey } from './cpp-library.js';
import { withArrays } from './array-spellings.js';
import { writePower } from './power.js';
import { writeQuestion, writePropertyAccess } from './questions.js';
import { writeDocumentationAssignment } from './documentation.js';
import { withQueryWriter } from './query-writer.js';
import { withObjpakWriter } from './objpak-writer.js';
import { withSqlValueWriter } from './sql-values.js';
import { namedType, withTypeMetadata } from './type-metadata.js';
import { withExceptions } from './exceptions.js';
import {
  checkRecordReferences,
  requireRecordSupport,
  supportsRecords,
} from './record-model.js';
import { writeRecord, writeRecordExpression } from './record-writer.js';
import { isRustPrint } from './rust-print.js';
import {
  mappedComments,
  mappedEmitter,
  mappedLine,
  renderLines,
} from '../translation/emission-map.js';
import {
  isReal,
  realValue,
  slashIsReal,
  withRealOperands,
  withReals,
} from './numbers.js';

const precedence = {
  or: 1,
  and: 2,
  equal: 3,
  notEqual: 3,
  less: 4,
  lessOrEqual: 4,
  greater: 4,
  greaterOrEqual: 4,
  stream: 4.5,
  rightShift: 4.5,
  add: 5,
  subtract: 5,
  multiply: 6,
  divide: 6,
  floorDivide: 6,
  realDivide: 6,
  remainder: 6,
  modulo: 6,
};
const comparisons = new Set([
  'equal',
  'notEqual',
  'less',
  'lessOrEqual',
  'greater',
  'greaterOrEqual',
]);
function operatorSpelling(syntax, operator) {
  if (['stream', 'rightShift'].includes(operator) && syntax.id !== 'cpp') {
    throw new Error(
      `C++ shift or stream operator requires a mapping for ${syntax.id}`
    );
  }
  return (
    syntax.operators[operator === 'modulo' ? 'remainder' : operator] ??
    symbols[operator]
  );
}

function comparisonParent(operator, part, level) {
  // Nested boolean comparisons need explicit grouping: some grammars chain
  // them, others reject adjacent operators or warn at strict compiler levels.
  return comparisons.has(operator) &&
    part.kind === 'Binary' &&
    comparisons.has(part.operator)
    ? 9
    : level;
}
const symbols = {
  stream: '<<',
  rightShift: '>>',
  add: '+',
  subtract: '-',
  multiply: '*',
  divide: '/',
  floorDivide: '/',
  realDivide: '/',
  remainder: '%',
  modulo: '%',
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

// The lines of a comment in a language: a block comment where the language
// prefers one (or has no line comment), otherwise one line comment per line.
// The import lines a used feature needs, before and after the common
// library imports.
const importsBeforeLibrary = [
  ['System.Linq', 'using System.Linq;'],
  ['inspect', 'import inspect'],
  ['sys', 'import sys'],
  ['typing', 'from typing import Annotated'],
  ['strformat', 'import std/strformat'],
  ['std.conv', 'import std.conv;'],
  ['dart:io', "import 'dart:io';"],
];
const importsAfterLibrary = [
  ['objc', objectiveCRuntimeHeader],
  ['stdbool', '#include <stdbool.h>'],
  ['stdio', '#include <stdio.h>'],
  ['iostream', '#include <iostream>'],
  ['string', '#include <string>'],
  ['fmt', 'import "fmt"'],
];

export function commentLines(syntax, id, text, { block: preferred } = {}) {
  const [open, close] = syntax.blockComment ?? [];
  // A PHP line comment ends at ?>. Use a block, escaping a foreign block
  // terminator when necessary, as failure-note comments already do.
  const phpClosingTag = id === 'php' && text.includes('?>');
  if (phpClosingTag) {
    text = text.replaceAll('*/', '* /');
  }
  const lines = text.split('\n');
  const block =
    open &&
    !text.includes(close) &&
    (blockCommentLanguages.has(id) ||
      phpClosingTag ||
      (preferred && lines.length > 1) ||
      syntax.lineComment === open ||
      (lines.length > 1 && !syntax.lineComment));
  if (block) {
    const body = [...lines];
    body[0] = `${open}${body[0] ? ` ${body[0]}` : ''}`;
    body[body.length - 1] += ` ${close}`;
    return body;
  }
  return lines.map((line) =>
    line ? `${syntax.lineComment} ${line}` : syntax.lineComment
  );
}

const isTrivia = (statement) =>
  statement.kind === 'Comment' || statement.kind === 'Blank';

class BaseEmitter {
  comments(owner, key = 'comments') {
    mappedComments(this, owner[key] ?? [], (text) => this.comment(text));
  }

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
    this.lines.push(
      mappedLine(this, content ? this.unit.repeat(this.depth) + content : '')
    );
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
    if (meta?.startsWith('source:')) {
      return namedType(meta, this.id);
    }
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
    if (format === 'escaped-braces') {
      result = result.replace(/\{/g, '\\{');
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
    const result = `${spaced}${this.expression(expression.operand, 9)}`;
    const level = this.id === 'python' && expression.operator === 'not' ? 2 : 7;
    return parent > level ? `(${result})` : result;
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
        return this.call(expression);
      case 'Question':
        return writeQuestion(this, expression);
      case 'Method':
        return writePropertyAccess(this, expression);
      case 'Unary':
        return this.unary(expression, parent);
      case 'Binary':
        return expression.operator === 'power'
          ? writePower(this, expression, parent)
          : this.binary(expression, parent);
      default:
        return this.specialExpression(expression, parent);
    }
  }

  specialExpression(expression) {
    if (
      expression.kind === 'SizeOf' &&
      ['c', 'cpp', 'objc'].includes(this.id)
    ) {
      return `sizeof(${this.expression(expression.operand)})`;
    }
    if (['RecordConstruction', 'RecordFieldRead'].includes(expression.kind)) {
      return writeRecordExpression(this, expression);
    }
    if (expression.kind === 'CppTemplateCall') {
      if (this.id !== 'cpp') {
        throw new Error(
          `C++ template call requires a library mapping for ${this.id}`
        );
      }
      return this.call(expression);
    }
    if (['c', 'cpp', 'objc'].includes(this.id)) {
      if (expression.kind === 'AssignmentExpression') {
        return `(${this.variable(expression.name)} = ${this.expression(expression.value)})`;
      }
      if (expression.kind === 'ExpressionSequence') {
        const values = [...expression.steps, expression.value];
        return `(${values.map((value) => this.expression(value)).join(', ')})`;
      }
    }
    throw new Error(
      `Cannot emit ${expression.kind} as an expression in ${this.id}`
    );
  }

  call({ callee, arguments: values, typeArguments }) {
    if (isRustPrint(callee)) {
      if (this.id !== 'rust') {
        throw new Error(`Rust format requires a native macro in ${this.id}`);
      }
      const written = values.map((value) =>
        value.kind === 'NamedArgument'
          ? `${value.name} = ${this.expression(value.value)}`
          : this.expression(value)
      );
      return `${callee}(${written.join(', ')})`;
    }
    const member = callee.startsWith('.');
    const receiver = member ? `${this.expression(values[0], 9)}` : '';
    const arguments0 = member ? values.slice(1) : values;
    const types = typeArguments
      ? `<${namedType(`source:${typeArguments}`, this.id)}>`
      : '';
    return `${receiver}${callee}${types}(${arguments0.map((value) => this.expression(value)).join(', ')})`;
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
      this.id === 'r' &&
      ['divide', 'floorDivide', 'remainder', 'modulo'].includes(
        expression.operator
      );
    // `a && b || c` keeps its meaning without parentheses, but readers (and
    // C compilers with -Wparentheses) expect them around the inner "and".
    const inner = expression.operator === 'or' ? precedence.and + 1 : level;
    const left = this.expression(
      expression.left,
      comparisonParent(expression.operator, expression.left, tight ? 7 : inner)
    );
    const right = this.expression(
      expression.right,
      comparisonParent(
        expression.operator,
        expression.right,
        tight ? 7 : Math.max(inner, level + 1)
      )
    );
    let result;
    if (['divide', 'floorDivide'].includes(expression.operator)) {
      const integer = this.syntax.operators.integerDivide;
      const spelling = this.syntax.integerDivision;
      const whole = (part) => this.expression(part);
      if (integer) {
        result = `${left} ${integer} ${right}`;
      } else if (spelling?.wrapper) {
        return `${spelling.wrapper}(${left} / ${right})`;
      } else if (spelling?.call) {
        return `${spelling.call}(${whole(expression.left)}, ${whole(expression.right)})`;
      } else if (spelling?.method) {
        return `${this.expression(expression.left, 8)}.${spelling.method}(${whole(expression.right)})`;
      } else {
        result = `${left} / ${right}`;
      }
    } else {
      const operator = operatorSpelling(this.syntax, expression.operator);
      result = `${left} ${operator} ${right}`;
    }
    return level < parent ? `(${result})` : result;
  }

  // Text joined with +, computed parts converted with the language's
  // conversion (Python 2: str(value)).
  concatenation(parts) {
    const [convert] = this.syntax.textConversions;
    return parts
      .map((part) =>
        part.kind === 'Text'
          ? this.quote(part.value)
          : part.type === 'text'
            ? this.expression(part, 6)
            : `${convert}(${this.expression(part)})`
      )
      .join(' + ');
  }

  // Text with the computed parts embedded between delimiters.
  embedded(parts, { prefix = '', open, close, format }) {
    if (this.id === 'nim') {
      this.uses.add('strformat');
    }
    return `${prefix}"${parts.map((part) => (part.kind === 'Text' ? this.escape(part.value, { format }) : `${open}${this.expression(part)}${close}`)).join('')}"`;
  }

  // Text built from literal and computed parts, outside of output calls.
  interpolation(parts) {
    if (this.syntax.textJoin === 'concatenation') {
      return this.concatenation(parts);
    }
    if (embeddings[this.id]) {
      return this.embedded(parts, embeddings[this.id]);
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
    const placeholders = {
      integer: '%d',
      real: '%g',
      text: '%s',
      boolean: '%d',
    };
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
    return this.ownSpelling(
      'print.line',
      printer(this, {
        value,
        newline,
        parts,
        lineParts: newline ? [...parts, { kind: 'Text', value: '\n' }] : parts,
        single: () => this.expression(value),
      })
    );
  }

  // A version of one's own may spell a word of its language differently
  // (print.line, returnArrow, mainName, ...): the usual spelling a writer
  // put down is replaced by its own.
  ownSpelling(concept, written) {
    const spelling = (syntax) =>
      concept.split('.').reduce((table, key) => table?.[key], syntax);
    const own = spelling(this.syntax);
    const usual = spelling(languageSyntax(this.syntax.id));
    return typeof own === 'string' &&
      typeof usual === 'string' &&
      usual &&
      own !== usual &&
      written.includes(usual)
      ? written.replace(usual, own)
      : written;
  }

  interpolationOrText(parts) {
    const merged = mergeTexts(parts);
    return merged.length === 1 && merged[0].kind === 'Text'
      ? this.quote(merged[0].value)
      : this.interpolation(merged);
  }

  // Concrete syntax: a comment keeps its text, its lines and, after code,
  // its place at the end of the line.
  comment(text, { trailing, block } = {}) {
    const lines = commentLines(this.syntax, this.id, text, { block });
    const last = this.lines.length - 1;
    if (trailing && lines.length === 1 && this.lines[last]) {
      this.lines[last] = mappedLine(
        this,
        `${this.lines[last]}${trailing}${lines[0]}`,
        this.lines[last]
      );
      return;
    }
    for (const line of lines) {
      this.line(line);
    }
  }

  // An empty line after a function unless the source had none before the
  // next function; the last one is always set apart from the main program.
  spacedAfter(functions, index) {
    return (
      functions[index].blankAfter !== false || index === functions.length - 1
    );
  }

  // Empty lines kept from the source, never two runs in a row.
  blank(lines = 1) {
    let missing = lines;
    for (let index = this.lines.length - 1; index >= 0; index -= 1) {
      if (this.lines[index] !== '' || missing === 0) {
        break;
      }
      missing -= 1;
    }
    for (let count = 0; count < missing; count += 1) {
      this.line();
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
        this.line(header ? `${header} {` : '{');
        break;
      case 'indentation':
        // Nim's procedure heads end with "=", not ":".
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
    const statements = layout(block.statements);
    for (const statement of statements) {
      this.statement(statement);
    }
    // A block that only holds comments still needs a statement.
    if (
      statements.every(isTrivia) &&
      this.syntax.blocks === 'indentation' &&
      this.depth > 0
    ) {
      this.line(this.syntax.emptyStatement ?? 'pass');
    }
  }

  statement(statement) {
    const end = this.terminator();
    switch (statement.kind) {
      case 'Comment':
        return this.comment(statement.text, statement);
      case 'Blank':
        return this.blank(statement.lines);
      case 'Print':
        return this.line(this.print(statement));
      case 'Evaluate':
        return this.line(`${this.expression(statement.expression)}${end}`);
      case 'PropertyAssignment':
        if (!['python', 'javascript', 'typescript'].includes(this.id)) {
          throw new Error(
            `Cannot emit property assignment in ${this.syntax.id}`
          );
        }
        return this.line(
          `${this.expression(statement.object)}.${statement.property} = ${this.expression(statement.value)}${end}`
        );
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
      case 'ForEach':
        return this.forEachLoop(statement);
      default:
        throw new Error(`Cannot emit ${statement.kind} as a statement`);
    }
  }

  declaration({ name, type, value, mutable, cppTemplateType, cppType }) {
    if (value?.kind === 'CppDirectInitializer') {
      if (this.id !== 'cpp') {
        throw new Error(
          `C++ direct initialization requires a library mapping for ${this.id}`
        );
      }
      const args = value.arguments.map((arg) => this.expression(arg));
      return `${this.type(cppType ?? type)} ${name}(${args.join(', ')});`;
    }
    if (cppTemplateType) {
      if (this.id !== 'cpp') {
        throw new Error(
          `C++ template type requires a library mapping for ${this.id}`
        );
      }
      if (!value) {
        return `${this.type(type)} ${name}${this.terminator()}`;
      }
      if (value.kind === 'CppInitializerList' && value.direct) {
        return `${this.type(type)} ${name}${this.expression(value)};`;
      }
    }
    const initial = this.expression(
      realValue(value ?? number(0), type, this.syntax)
    );
    const declare = declarers[this.id] ?? declarers.typedPrefix;
    return declare(this, { name, type, mutable, initial });
  }

  // The meta language only knows `x = value`; `x = x + 1` is written back
  // as `x += 1` in every language that has compound assignment.
  assignment({ name: identifier, value: original }) {
    const target = this.variable(identifier);
    const value =
      original.kind === 'Binary'
        ? withRealOperands(original, this.syntax)
        : original;
    const compound = compoundOperators[value.operator];
    // Languages that spell integer division as a call or a wrapper, or with
    // an operator of its own, would lose the truncation with `/=`; `/=` of
    // an integer variable divides integers where `/` depends on the types.
    const plainDivision =
      value.operator === 'divide'
        ? !(this.syntax.integerDivision || this.syntax.operators.integerDivide)
        : value.operator !== 'realDivide' ||
          slashIsReal(this.syntax) ||
          isReal(value.left);
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
      return `${this.syntax.elseIf ?? 'elseif'} ${condition} then`;
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
      javascript: `for (${this.syntax.declarationKeyword ?? 'let'} ${identifier} = ${from}; ${identifier} < ${to}; ${identifier}++)`,
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

  // The loop header is the language's `forEach` template with the loop
  // variable, its type and the array filled in.
  forEachLoop({ variable: identifier, array, body, type = 'integer' }) {
    const fill = {
      type: this.type(type),
      variable: this.variable(identifier),
      array: this.expression(array),
      'array-name': array.name,
    };
    this.openBlock(
      this.syntax.forEach.replace(/\{([a-z-]+)\}/g, (_, key) => fill[key])
    );
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
    const parameterType = ({ type, cppType }) =>
      this.type(this.id === 'cpp' ? (cppType ?? type) : type);
    const typed = (render) =>
      item.parameters
        .map((parameter) => render(parameter.name, parameterType(parameter)))
        .join(', ');
    const names = item.parameters.map((parameter) => parameter.name).join(', ');
    const returns = item.returnType;
    const after = (arrow) =>
      returns === 'nothing'
        ? ''
        : `${this.ownSpelling('returnArrow', arrow)}${this.type(returns)}`;
    const head = write({
      name: item.name,
      typed,
      names,
      after,
      returns: this.type(returns),
    });
    // A version of one's own may spell the function keyword differently.
    const own = this.syntax.functionKeyword;
    const usual = languageSyntax(this.syntax.id).functionKeyword;
    return own && usual && own !== usual
      ? head.replace(new RegExp(`(^|\\s)${usual}(?=\\s)`), `$1${own}`)
      : head;
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
    if (
      item.documentation &&
      !['python', 'javascript', 'typescript'].includes(this.id)
    ) {
      throw new Error(`Cannot emit runtime documentation in ${this.syntax.id}`);
    }
    this.comments(item, 'comments');
    for (const annotation of item.annotations ?? []) {
      if (!['java', 'kotlin', 'python'].includes(this.id)) {
        throw new Error(`Annotations need a framework mapping for ${this.id}`);
      }
      this.line(`@${this.expression(annotation.expression)}`);
    }
    this.openBlock(this.definitionHeading(item));
    if (item.documentation && this.id === 'python') {
      this.line(this.expression(item.documentation));
    }
    // Perl receives its arguments in @_.
    if (this.syntax.parameters === 'unpacked' && item.parameters.length) {
      const names = item.parameters.map(({ name: id }) => this.variable(id));
      this.line(`my (${names.join(', ')}) = @_;`);
    }
    this.body(item.body);
    this.closeBlock();
    writeDocumentationAssignment(this, item);
  }

  mainHeader() {
    const header = {
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
    return header && this.ownSpelling('mainName', header);
  }

  program(program) {
    const items = this.id === 'cpp' ? cppFileItems(program) : program.functions;
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
      const announced = laterCalls(items);
      this.announced = new Set(announced.map((item) => item.name));
      for (const item of announced) {
        this.line(this.forwardDeclaration(item));
      }
      if (announced.length) {
        this.line();
      }
    }
    for (const definition of program.definitions ?? []) {
      this.recordDefinition(definition);
      this.line();
    }
    items.forEach((item, index) => {
      if (item.kind !== 'Function') {
        this.statement(item);
        return;
      }
      this.functionDefinition(item);
      // A main procedure of its own is set apart from the functions.
      if (
        item.blankAfter !== false ||
        (index === items.length - 1 && this.mainHeader())
      ) {
        this.line();
      }
    });
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
      this.lines.push(this.syntax.header ?? '<?php', '');
    }
    this.comments(program, 'comments');
    if (program.comments.length) {
      this.line();
    }
    return renderLines(this, [
      ...this.lines,
      ...this.prelude(program),
      ...body,
    ]);
  }

  recordDefinition(definition) {
    writeRecord(this, definition);
  }

  recordField(_field, line) {
    this.line(line);
  }

  // The top-level statements, in a main procedure where the language has one.
  main(program) {
    this.comments(program, 'mainComments');
    const [count, vector] = program.mainParameters ?? [];
    const header = count
      ? `int main(int ${this.variable(count.name)}, char **${this.variable(vector.name)})`
      : this.mainHeader();
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
    const used = (headers) =>
      headers.filter(([use]) => this.uses.has(use)).map(([, line]) => line);
    const library = program.libraryImports ?? [];
    const imported = new Set(library.map(nativeImportKey));
    lines.push(...used(importsBeforeLibrary), ...library);
    lines.push(
      ...used(importsAfterLibrary).filter(
        (line) => !imported.has(nativeImportKey(line))
      )
    );
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
  realDivide: '/=',
  remainder: '%=',
};

// Arrays are written by a mixin of their own, which the dialects inherit.
const Emitter = withSqlValueWriter(
  withQueryWriter(
    withObjpakWriter(
      withExceptions(withTypeMetadata(withReals(withArrays(BaseEmitter))))
    )
  )
);

export function emitProgram(program, languageId) {
  const LanguageEmitter = emitterFor(languageId);
  const syntax = languageSyntax(languageId);
  requireNativeEntrySupport(program, languageId);
  requireRecordSupport(program, languageId, supportsRecords(syntax));
  if (program.definitions?.length) {
    checkRecordReferences(program);
  }
  return mappedEmitter(new LanguageEmitter(syntax)).program(program);
}

export function requireNativeEntrySupport(program, target) {
  if (!program.mainParameters?.length) {
    return;
  }
  if (!['c', 'cpp'].includes(splitVersion(target).id)) {
    throw new Error(`C entry-point parameters require a mapping for ${target}`);
  }
  const [count, vector] = program.mainParameters;
  if (
    program.mainParameters.length !== 2 ||
    count.type !== 'integer' ||
    vector.type !== 'array<text>'
  ) {
    throw new Error(
      'C entry point requires an integer count and a text vector'
    );
  }
}

// Languages with a program layout of their own (Fortran, Pascal, Ada,
// Visual Basic, Bash, MATLAB, Zig, Lean, Rocq) extend the shared emitter in
// dialects/.
const dialectEmitters = new Map();
function emitterFor(languageId) {
  const extend = dialects[splitVersion(languageId).id]?.emitter;
  if (!extend) {
    return Emitter;
  }
  if (!dialectEmitters.has(extend)) {
    dialectEmitters.set(extend, extend(Emitter));
  }
  return dialectEmitters.get(extend);
}

// How each language writes a value to standard output. C, Go and Rust use
// format strings, so the value is rendered only where it is needed.
const printers = {
  javascript: (emitter, { value, newline, single }) =>
    newline
      ? `console.log(${single()});`
      : `process.stdout.write(${value.type === 'text' ? single() : `String(${single()})`});`,
  python: (emitter, { value, newline, single }) => {
    if (!emitter.syntax.printStatement) {
      return newline ? `print(${single()})` : `print(${single()}, end="")`;
    }
    if (newline) {
      return value.kind === 'Text' && value.value === ''
        ? 'print'
        : `print ${single()}`;
    }
    emitter.uses.add('sys');
    return `sys.stdout.write(${value.type === 'text' ? single() : `str(${single()})`})`;
  },
  ruby: (emitter, { newline, single }) => {
    const value = single();
    return value.startsWith('-')
      ? `${newline ? 'puts' : 'print'}(${value})`
      : `${newline ? 'puts' : 'print'} ${value}`;
  },
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
  swift: (emitter, { newline, single }) => {
    // Swift 1 prints a line with println and text with print.
    const own = emitter.syntax.printCalls;
    if (own) {
      return `${newline ? own.line[0] : own.text[0]}(${single()})`;
    }
    return newline
      ? `print(${single()})`
      : `print(${single()}, terminator: "")`;
  },
  perl: (emitter, { lineParts }) =>
    `print(${emitter.interpolationOrText(lineParts)});`,
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
const rustTypes = { integer: ': i64', real: ': f64' };
const declarers = {
  javascript: (emitter, { name, mutable, initial }) =>
    `${emitter.syntax.declarationKeyword ?? (mutable ? 'let' : 'const')} ${name} = ${initial};`,
  python: (emitter, { name, initial }) => `${name} = ${initial}`,
  php: (emitter, { name, initial }) => `$${name} = ${initial};`,
  lua: (emitter, { name, initial }) => `local ${name} = ${initial}`,
  go: (emitter, { name, initial }) => `${name} := ${initial}`,
  rust: (emitter, { name, type, mutable, initial }) =>
    `let ${mutable ? 'mut ' : ''}${name}${rustTypes[type] ?? ''} = ${initial};`,
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
