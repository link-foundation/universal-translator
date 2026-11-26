// How the shared parser reads two more surface forms of familiar concepts:
// JavaScript arrow functions bound to a name, which define a function as
// `function name(...) { ... }` does, and Python type hints on parameters,
// results and assignments, which tell the meta type where one fits.

import { block, node } from '../meta/tree.js';
import { sourceType } from './parser.js';

// Python hints with a meta type. Every other hint (float, dict[str, int],
// a class name) is read and left to type inference.
const hintTypes = new Map([
  ['int', 'integer'],
  ['str', 'text'],
  ['bool', 'boolean'],
  ['None', 'nothing'],
  ['list[int]', 'array'],
  ['List[int]', 'array'],
]);

export const hintType = (spelling) => hintTypes.get(spelling);

// Words that start a Python statement and may be followed by ":".
const pythonKeywords = new Set([
  'else',
  'elif',
  'try',
  'except',
  'finally',
  'with',
  'lambda',
  'class',
  'def',
]);

const arrowLanguages = new Set(['javascript', 'typescript']);

export const withFunctionForms = (Base) =>
  class extends Base {
    item() {
      return this.isArrowFunctionStart() ? this.arrowFunction() : super.item();
    }

    typeExpression() {
      return this.syntax.id === 'python'
        ? this.typeHint()
        : super.typeExpression();
    }

    simpleStatement() {
      return this.isAnnotatedAssignment()
        ? this.annotatedAssignment()
        : super.simpleStatement();
    }

    // [modifiers] const|let|var name = (parameters) => ...
    // [modifiers] const|let|var name = parameter => ...
    isArrowFunctionStart() {
      if (!arrowLanguages.has(this.syntax.id)) {
        return false;
      }
      let offset = 0;
      while (this.isModifier(offset)) {
        offset += 1;
      }
      const bound =
        this.syntax.declarations.includes(this.peek(offset).value) &&
        this.peek(offset + 1).type === 'name' &&
        this.is('=', offset + 2);
      if (!bound) {
        return false;
      }
      const start = offset + 3;
      if (this.peek(start).type === 'name') {
        return this.is('=>', start + 1);
      }
      const close = this.closingParenthesis(start);
      return (
        close !== undefined && this.is('=>', this.afterResultType(close + 1))
      );
    }

    // The offset after a TypeScript result type written before "=>".
    afterResultType(offset) {
      if (!this.is(':', offset)) {
        return offset;
      }
      let after = offset;
      while (
        !this.is('=>', after) &&
        !this.is(';', after) &&
        !['newline', 'end'].includes(this.peek(after).type)
      ) {
        after += 1;
      }
      return after;
    }

    isModifier(offset) {
      return ['export', 'async'].includes(this.peek(offset).value);
    }

    // The same Function node as `function name(parameters) { body }`; an
    // expression body is the value the function returns.
    arrowFunction() {
      while (this.isModifier(0)) {
        this.next();
      }
      this.next();
      const functionName = this.expectName();
      this.expect('=');
      const parameters = this.is('(')
        ? this.parameterList()
        : [{ name: this.expectName(), type: undefined }];
      let returnType;
      if (this.accept(':')) {
        const words = [];
        while (!this.is('=>')) {
          words.push(this.next().value);
        }
        returnType = sourceType(words.join(' '));
      }
      this.expect('=>');
      const body = this.is('{') ? this.block() : this.arrowExpressionBody();
      return node('Function', {
        name: functionName,
        parameters,
        returnType,
        body,
      });
    }

    arrowExpressionBody() {
      const value = this.expression();
      this.endStatement();
      return block([node('Return', { value })]);
    }

    // A Python hint ends at ":", "=", "," or ")" outside brackets, so
    // `dict[str, int]` is read whole.
    typeHint() {
      const words = [];
      let depth = 0;
      while (!['newline', 'end'].includes(this.peek().type)) {
        if (depth === 0 && [':', '=', ',', ')'].some((stop) => this.is(stop))) {
          break;
        }
        depth += this.is('[') ? 1 : this.is(']') ? -1 : 0;
        words.push(this.next().value);
      }
      return hintType(words.join(''));
    }

    // Python: name: hint [= value]
    isAnnotatedAssignment() {
      return (
        this.syntax.id === 'python' &&
        this.peek().type === 'name' &&
        !pythonKeywords.has(this.peek().value) &&
        this.is(':', 1)
      );
    }

    // `total: int = 0` assigns as `total = 0` does, with the hinted type;
    // a hint without a value (`total: int`) assigns nothing.
    annotatedAssignment() {
      const variable = this.next().value;
      this.expect(':');
      const type = this.typeHint();
      if (!this.accept('=')) {
        this.endStatement();
        return node('Statements', { statements: [] });
      }
      const value = this.expression();
      this.endStatement();
      return node('Assignment', {
        name: variable,
        operator: '=',
        value,
        ...(type ? { type } : {}),
      });
    }
  };
