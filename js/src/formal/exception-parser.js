// Exception bodies and handlers retain their control-flow boundaries.
import { node } from '../meta/tree.js';
import { SyntaxError } from './lexer.js';
import { sourceType } from './type-metadata.js';

const languages = new Set(['cpp', 'javascript', 'typescript', 'python']);
const distinctCppTypes = new Set([
  'bool',
  'char',
  'double',
  'float',
  'int',
  'long',
  'short',
]);

function cppIntLiteral(tokens) {
  const literal = tokens.at(-1);
  return (
    (tokens.length === 1 || (tokens.length === 2 && tokens[0].value === '-')) &&
    literal?.type === 'number' &&
    /^(0|[1-9]\d{0,4})$/.test(literal.value) &&
    Number(literal.value) <= 32767
  );
}

export const withExceptionParser = (Base) =>
  class extends Base {
    statement() {
      if (languages.has(this.syntax.id)) {
        if (this.is('try')) {
          return this.tryStatement();
        }
        if (this.is(this.syntax.id === 'python' ? 'raise' : 'throw')) {
          this.next();
          if (this.syntax.id === 'cpp') {
            while (this.peek().type === 'newline') {
              this.next();
            }
          }
          const start = this.position;
          const value = this.isStatementEnd() ? undefined : this.expression();
          const cppType =
            this.syntax.id === 'cpp' &&
            cppIntLiteral(this.tokens.slice(start, this.position))
              ? 'int'
              : undefined;
          this.endStatement();
          return node('Throw', {
            value,
            mode: this.syntax.id === 'python' ? 'exception' : 'value',
            ...(cppType && { cppType }),
          });
        }
      }
      return super.statement();
    }

    tryStatement() {
      this.expect('try');
      const body = this.block();
      const handlers = [];
      this.skipLineEnds();
      const python = this.syntax.id === 'python';
      while (this.accept(python ? 'except' : 'catch')) {
        const parameter = this.catchParameter();
        handlers.push(node('Catch', { ...parameter, body: this.block() }));
        this.skipLineEnds();
      }
      const success = python && this.accept('else') ? this.block() : undefined;
      this.skipLineEnds();
      const finalizer = this.accept('finally') ? this.block() : undefined;
      if (!handlers.length && !finalizer) {
        throw new SyntaxError(
          'A try statement needs a handler or finally block',
          this.peek().line
        );
      }
      return node('Try', { body, handlers, success, finalizer });
    }

    catchParameter() {
      let name;
      let type;
      if (this.syntax.id === 'python') {
        if (!this.is(':')) {
          const words = [];
          while (!this.is('as') && !this.is(':')) {
            words.push(this.next().value);
          }
          type = `source:${words.join('')}`;
          if (this.accept('as')) {
            name = this.expectName();
          }
        }
      } else if (this.accept('(')) {
        if (this.syntax.id === 'cpp') {
          return this.cppCatchParameter();
        }
        name = this.expectName();
        this.expect(')');
      }
      return { name, type };
    }

    cppCatchParameter() {
      const tokens = [];
      while (!this.is(')')) {
        tokens.push(this.next());
      }
      this.expect(')');
      const words = tokens.map(({ value }) => value);
      if (words.join('') === '...') {
        return { cppType: '...' };
      }
      const name = words.length > 1 ? words.pop() : undefined;
      const type = sourceType(words.join(' '));
      const cppType =
        words.length === 1 &&
        distinctCppTypes.has(words[0]) &&
        (!name ||
          (tokens[1].type === 'name' && !['const', 'volatile'].includes(name)))
          ? words[0]
          : undefined;
      return { name, type, ...(cppType && { cppType }) };
    }
  };
