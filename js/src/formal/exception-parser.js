// Exception bodies and handlers retain their control-flow boundaries.
import { node } from '../meta/tree.js';
import { SyntaxError } from './lexer.js';
import { sourceType } from './parser.js';

const languages = new Set(['cpp', 'javascript', 'typescript', 'python']);

export const withExceptionParser = (Base) =>
  class extends Base {
    statement() {
      if (languages.has(this.syntax.id)) {
        if (this.is('try')) {
          return this.tryStatement();
        }
        if (this.is(this.syntax.id === 'python' ? 'raise' : 'throw')) {
          this.next();
          const value = this.isStatementEnd() ? undefined : this.expression();
          this.endStatement();
          return node('Throw', {
            value,
            mode: this.syntax.id === 'python' ? 'exception' : 'value',
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
          const words = [];
          while (!this.is(')')) {
            words.push(this.next().value);
          }
          if (words.join('') !== '...') {
            name = words.length > 1 ? words.pop() : undefined;
            type = sourceType(words.join(' '));
          }
        } else {
          name = this.expectName();
        }
        this.expect(')');
      }
      return { name, type };
    }
  };
