// Emitter: renders a typed meta program in a target language. Every
// language-specific spelling comes from languages.js or from the small
// tables below; the structure of the output follows the meta tree.

import { add, number } from './meta.js';
import { languageSyntax } from './languages.js';

const precedence = {
  or: 1, and: 2, equal: 3, notEqual: 3, less: 4, lessOrEqual: 4, greater: 4,
  greaterOrEqual: 4, add: 5, subtract: 5, multiply: 6, divide: 6, remainder: 6,
};
const symbols = {
  add: '+', subtract: '-', multiply: '*', divide: '/', remainder: '%', less: '<',
  lessOrEqual: '<=', greater: '>', greaterOrEqual: '>=', equal: '==', notEqual: '!=',
};
const conditionParentheses = new Set(['c', 'cpp', 'csharp', 'java', 'javascript', 'typescript', 'kotlin', 'php']);
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
    return ['python', 'ruby', 'lua', 'go', 'kotlin', 'swift'].includes(this.syntax.id) ? '' : ';';
  }

  // ---- names, types, literals ----
  variable(identifier) {
    return this.syntax.variableSigil ? `${this.syntax.variableSigil}${identifier}` : identifier;
  }

  type(meta) {
    const types = this.syntax.types ?? {};
    if (meta === 'text' && this.syntax.id === 'cpp') this.uses.add('string');
    return types[meta] ?? types.integer;
  }

  escape(value, { format } = {}) {
    let result = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\t/g, '\\t').replace(/\r/g, '\\r');
    if (['php', 'kotlin'].includes(this.syntax.id)) result = result.replace(/\$/g, '\\$');
    if (this.syntax.id === 'ruby') result = result.replace(/#\{/g, '\\#{');
    if (format === 'percent') result = result.replace(/%/g, '%%');
    if (format === 'braces') result = result.replace(/\{/g, '{{').replace(/\}/g, '}}');
    return result;
  }

  quote(value) {
    return `"${this.escape(value)}"`;
  }

  // ---- expressions ----
  expression(expression, parent = 0) {
    switch (expression.kind) {
      case 'Number':
        return expression.value < 0 && parent > 6 ? `(${expression.value})` : String(expression.value);
      case 'Text':
        return this.quote(expression.value);
      case 'Boolean':
        return (this.syntax.words ?? {})[String(expression.value)] ?? String(expression.value);
      case 'Name':
        return this.variable(expression.name);
      case 'Interpolation':
        return this.interpolation(expression.parts);
      case 'Call':
        return `${expression.callee}(${expression.arguments.map((argument) => this.expression(argument)).join(', ')})`;
      case 'Unary': {
        const operator = expression.operator === 'not' ? this.syntax.operators.not : '-';
        const spaced = /\w$/.test(operator) ? `${operator} ` : operator;
        const result = `${spaced}${this.expression(expression.operand, 7)}`;
        return parent > 7 ? `(${result})` : result;
      }
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
      if (integer) result = `${left} ${integer} ${right}`;
      else if (this.syntax.id === 'javascript' || this.syntax.id === 'typescript') return `Math.trunc(${this.expression(expression.left)} / ${this.expression(expression.right)})`;
      else if (this.syntax.id === 'php') return `intdiv(${this.expression(expression.left)}, ${this.expression(expression.right)})`;
      else result = `${left} / ${right}`;
    } else {
      const operator = this.syntax.operators[expression.operator] ?? symbols[expression.operator];
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
        return parts.map((part) => (part.kind === 'Text' ? this.quote(part.value) : this.expression(part, 6))).join(' . ');
      case 'swift':
        return render('\\(', ')');
      case 'rust':
        return `format!(${this.formatArguments(parts, 'braces')})`;
      case 'go':
        this.uses.add('fmt');
        return `fmt.Sprintf(${this.formatArguments(parts, 'percent')})`;
      case 'lua':
        return parts.map((part) => (part.kind === 'Text' ? this.quote(part.value) : this.expression(part, 6))).join(' .. ');
      case 'cpp':
        this.uses.add('string');
        return parts.map((part, index) => (part.kind === 'Text' ? (index === 0 ? `std::string(${this.quote(part.value)})` : this.quote(part.value)) : part.type === 'text' ? this.expression(part, 6) : `std::to_string(${this.expression(part)})`)).join(' + ');
      case 'java': {
        const pieces = parts.map((part) => (part.kind === 'Text' ? this.quote(part.value) : this.expression(part, 6)));
        return parts[0].kind === 'Text' ? pieces.join(' + ') : ['""', ...pieces].join(' + ');
      }
      default:
        throw new Error(`${this.syntax.label} has no text interpolation in this translator`);
    }
  }

  // "format string", value, value  — for printf-like and format!-like calls.
  formatArguments(parts, style) {
    const placeholders = { integer: '%d', text: '%s', boolean: '%d' };
    if (this.syntax.id === 'go') placeholders.boolean = '%t';
    const format = parts.map((part) => (part.kind === 'Text' ? this.escape(part.value, { format: style }) : style === 'braces' ? '{}' : placeholders[part.type] ?? '%d')).join('');
    const values = parts.filter((part) => part.kind !== 'Text').map((part) => this.expression(part));
    return [`"${format}"`, ...values].join(', ');
  }

  // ---- statements ----
  print({ value, newline }) {
    const parts = value.kind === 'Interpolation' ? value.parts : [value];
    const end = this.terminator();
    // Rendered on demand: C, Go and Rust use format strings instead.
    const single = () => this.expression(value);
    switch (this.syntax.id) {
      case 'javascript':
      case 'typescript':
        return newline ? `console.log(${single()});` : `process.stdout.write(${value.type === 'text' ? single() : `String(${single()})`});`;
      case 'python':
        return newline ? `print(${single()})` : `print(${single()}, end="")`;
      case 'ruby':
        return `${newline ? 'puts' : 'print'} ${single()}`;
      case 'lua':
        return newline ? `print(${single()})` : `io.write(${single()})`;
      case 'php':
        return `echo ${this.interpolationOrText(newline ? [...parts, { kind: 'Text', value: '\n' }] : parts)};`;
      case 'c':
        this.uses.add('stdio');
        return `printf(${this.formatArguments(newline ? [...parts, { kind: 'Text', value: '\n' }] : parts, 'percent')});`;
      case 'cpp':
        this.uses.add('iostream');
        return `std::cout << ${parts.map((part) => this.expression(part, 6)).join(' << ')}${newline ? ' << std::endl' : ''};`;
      case 'go':
        this.uses.add('fmt');
        if (parts.length === 1) return `fmt.${newline ? 'Println' : 'Print'}(${single()})`;
        return `fmt.Printf(${this.formatArguments(newline ? [...parts, { kind: 'Text', value: '\n' }] : parts, 'percent')})`;
      case 'rust':
        return `${newline ? 'println!' : 'print!'}(${this.formatArguments(parts, 'braces')});`;
      case 'csharp':
        return `System.Console.${newline ? 'WriteLine' : 'Write'}(${single()});`;
      case 'java':
        return `System.out.${newline ? 'println' : 'print'}(${single()});`;
      case 'kotlin':
        return `${newline ? 'println' : 'print'}(${single()})${end}`;
      case 'swift':
        return newline ? `print(${single()})` : `print(${single()}, terminator: "")`;
      default:
        throw new Error(`No output procedure for ${this.syntax.label}`);
    }
  }

  interpolationOrText(parts) {
    const merged = parts.reduce((result, part) => {
      if (part.kind === 'Text' && result.at(-1)?.kind === 'Text') {
        return [...result.slice(0, -1), { kind: 'Text', value: result.at(-1).value + part.value }];
      }
      return [...result, part];
    }, []);
    return merged.length === 1 && merged[0].kind === 'Text' ? this.quote(merged[0].value) : this.interpolation(merged);
  }

  comment(text) {
    if (blockCommentLanguages.has(this.syntax.id)) this.line(`/* ${text} */`);
    else this.line(`${this.syntax.lineComment} ${text}`);
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
    if (this.syntax.blocks === 'braces') this.line('}');
    if (this.syntax.blocks === 'end') this.line('end');
  }

  body(block) {
    if (block.statements.length === 0 && this.syntax.blocks === 'indentation') {
      this.line('pass');
    }
    for (const statement of block.statements) this.statement(statement);
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
        return this.line(statement.value ? `return ${this.expression(statement.value)}${end}` : `return${end}`);
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

  declaration({ name: identifier, type, value, mutable }) {
    const end = this.terminator();
    const initial = value ? this.expression(value) : this.expression(number(0));
    switch (this.syntax.id) {
      case 'javascript':
      case 'typescript':
        return `${mutable ? 'let' : 'const'} ${identifier} = ${initial};`;
      case 'python':
      case 'ruby':
        return `${identifier} = ${initial}`;
      case 'php':
        return `$${identifier} = ${initial};`;
      case 'lua':
        return `local ${identifier} = ${initial}`;
      case 'go':
        return `${identifier} := ${initial}`;
      case 'rust':
        return `let ${mutable ? 'mut ' : ''}${identifier}${type === 'integer' ? ': i64' : ''} = ${initial};`;
      case 'kotlin':
        return `${mutable ? 'var' : 'val'} ${identifier} = ${initial}${end}`;
      case 'swift':
        return `${mutable ? 'var' : 'let'} ${identifier} = ${initial}`;
      default:
        return `${this.type(type)} ${identifier} = ${initial};`;
    }
  }

  assignment({ name: identifier, operator, value }) {
    const target = this.variable(identifier);
    if (this.syntax.id === 'lua' && operator !== '=') {
      const meta = { '+=': 'add', '-=': 'subtract', '*=': 'multiply', '/=': 'divide', '%=': 'remainder' }[operator];
      return `${target} = ${this.expression({ kind: 'Binary', operator: meta, left: { kind: 'Name', name: identifier }, right: value })}`;
    }
    return `${target} ${operator} ${this.expression(value)}${this.terminator()}`;
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
      this.line({ braces: '} else {', indentation: 'else:', end: 'else' }[this.syntax.blocks]);
      this.depth += 1;
      this.body(otherwise);
    }
    this.closeBlock();
  }

  elseIfHeader(expression) {
    const condition = this.condition(expression);
    if (this.syntax.blocks === 'braces') return `} else if ${condition} {`;
    if (this.syntax.id === 'python') return `elif ${condition}:`;
    if (this.syntax.id === 'lua') return `elseif ${condition} then`;
    return `${this.syntax.elseIf} ${condition}`;
  }

  whileStatement(statement) {
    const condition = this.condition(statement.condition);
    const header = this.syntax.id === 'go' ? `for ${condition}` : this.syntax.id === 'lua' ? `while ${condition} do` : `while ${condition}`;
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
      python: start.kind === 'Number' && start.value === 0 ? `for ${identifier} in range(${this.expression(end)})` : `for ${identifier} in range(${from}, ${this.expression(end)})`,
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
    const parameters = item.parameters;
    const returns = item.returnType;
    const list = (render) => parameters.map(render).join(', ');
    switch (this.syntax.id) {
      case 'javascript':
        return `function ${item.name}(${list((parameter) => parameter.name)})`;
      case 'typescript':
        return `function ${item.name}(${list((parameter) => `${parameter.name}: ${this.type(parameter.type)}`)}): ${this.type(returns)}`;
      case 'python':
      case 'ruby':
        return `def ${item.name}(${list((parameter) => parameter.name)})`;
      case 'lua':
        return `local function ${item.name}(${list((parameter) => parameter.name)})`;
      case 'php':
        return `function ${item.name}(${list((parameter) => `$${parameter.name}`)})`;
      case 'go':
        return `func ${item.name}(${list((parameter) => `${parameter.name} ${this.type(parameter.type)}`)})${returns === 'nothing' ? '' : ` ${this.type(returns)}`}`;
      case 'rust':
        return `fn ${item.name}(${list((parameter) => `${parameter.name}: ${this.type(parameter.type)}`)})${returns === 'nothing' ? '' : ` -> ${this.type(returns)}`}`;
      case 'kotlin':
        return `fun ${item.name}(${list((parameter) => `${parameter.name}: ${this.type(parameter.type)}`)})${returns === 'nothing' ? '' : `: ${this.type(returns)}`}`;
      case 'swift':
        return `func ${item.name}(${list((parameter) => `_ ${parameter.name}: ${this.type(parameter.type)}`)})${returns === 'nothing' ? '' : ` -> ${this.type(returns)}`}`;
      case 'csharp':
      case 'java':
        return `static ${this.type(returns)} ${item.name}(${list((parameter) => `${this.type(parameter.type)} ${parameter.name}`)})`;
      default:
        return `${this.type(returns)} ${item.name}(${list((parameter) => `${this.type(parameter.type)} ${parameter.name}`)})`;
    }
  }

  functionDefinition(item) {
    for (const text of item.comments ?? []) this.comment(text);
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
      this.openBlock(this.syntax.id === 'csharp' ? 'class Program' : 'class Main');
    }
    for (const item of program.functions) {
      this.functionDefinition(item);
      this.line();
    }
    const header = this.mainHeader();
    if (header) {
      for (const text of program.mainComments ?? []) this.comment(text);
      this.openBlock(header);
      this.body(program.main);
      this.closeBlock();
    } else {
      for (const text of program.mainComments ?? []) this.comment(text);
      this.body(program.main);
    }
    if (insideClass) this.closeBlock();
    while (this.lines.at(-1) === '') this.lines.pop();
    const body = this.lines;
    this.lines = [];
    // File comments come first, except where a header must open the file.
    if (this.syntax.id === 'php') this.lines.push('<?php', '');
    for (const text of program.comments) this.comment(text);
    if (program.comments.length) this.line();
    return `${[...this.lines, ...this.prelude(), ...body].join('\n')}\n`;
  }

  prelude() {
    const lines = [];
    if (this.syntax.id === 'go') lines.push('package main', '');
    if (this.uses.has('stdio')) lines.push('#include <stdio.h>');
    if (this.uses.has('iostream')) lines.push('#include <iostream>');
    if (this.uses.has('string')) lines.push('#include <string>');
    if (this.uses.has('fmt')) lines.push('import "fmt"');
    if (lines.length && lines.at(-1) !== '') lines.push('');
    return lines;
  }
}

export function emitProgram(program, languageId) {
  return new Emitter(languageSyntax(languageId)).program(program);
}
