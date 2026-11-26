// How the shared parser reads Python type hints on parameters, results and
// assignments, which tell the meta type where one fits. (Arrow functions
// are read by the shared parser itself, see arrowFunctionDefinition in parser.js.)

import { node } from '../meta/tree.js';

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

export const withFunctionForms = (Base) =>
  class extends Base {
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
