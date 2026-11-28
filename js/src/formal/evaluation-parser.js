// Native C-family assignment/comma expressions preserve evaluation sequences.
import { node } from '../meta/tree.js';
const supported = (parser) => ['c', 'cpp', 'objc'].includes(parser.syntax.id);
export const withEvaluationParser = (Base) =>
  class extends Base {
    expression() {
      const left = super.expression();
      return supported(this) && left.kind === 'Name' && this.accept('=')
        ? node('AssignmentExpression', {
            name: left.name,
            value: this.expression(),
          })
        : left;
    }
    primary() {
      if (!supported(this) || !this.accept('(')) {
        return super.primary();
      }
      const values = [this.expression()];
      while (this.accept(',')) {
        values.push(this.expression());
      }
      this.expect(')');
      const value = values.pop();
      return values.length
        ? node('ExpressionSequence', { steps: values, value })
        : value;
    }
  };
