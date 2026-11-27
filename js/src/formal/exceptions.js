// Runtime carriers keep C++ values throwable in languages whose exceptions
// must be objects. The tag distinguishes integer and real payloads.
import { walk } from '../meta/tree.js';
import { declaredNames } from './names.js';
import { withCExceptions } from './c-exceptions.js';

import {
  exceptionMarker as marker,
  withExceptionHandlers,
} from './exception-handlers.js';
const supported = new Set(['cpp', 'python', 'javascript', 'typescript']);

export const withExceptions = (Base) =>
  class extends withCExceptions(withExceptionHandlers(Base)) {
    program(program) {
      this.exceptionNames = declaredNames(program);
      walk(program, (item) => {
        if (item.name) {
          this.exceptionNames.add(item.name);
        }
      });
      return super.program(program);
    }

    freshExceptionName(role) {
      this.exceptionNames ??= new Set();
      let index = 0;
      while (this.exceptionNames.has(`_ut_${role}${index}`)) {
        index += 1;
      }
      const name = `_ut_${role}${index}`;
      this.exceptionNames.add(name);
      return name;
    }

    statement(statement) {
      if (['Try', 'Throw'].includes(statement.kind)) {
        if (this.syntax.id === 'c') {
          return this.cExceptionStatement(statement);
        }
        if (!supported.has(this.id)) {
          throw new Error(
            `Exception translation is unavailable for ${this.id}`
          );
        }
        return statement.kind === 'Try'
          ? this.tryStatement(statement)
          : this.throwStatement(statement);
      }
      return super.statement(statement);
    }

    throwStatement({ value, mode }) {
      if (!value) {
        return this.line(
          this.id === 'python'
            ? 'raise'
            : this.id === 'cpp'
              ? 'throw;'
              : `throw ${this.activeException};`
        );
      }
      const written = this.expression(value);
      if (this.id === 'python' && mode === 'exception') {
        return this.line(`raise ${written}`);
      }
      if (this.id === 'cpp') {
        return this.line(`throw ${written};`);
      }
      const payload = [
        this.quote(marker),
        this.quote(value.type ?? ''),
        written,
      ].join(', ');
      this.line(
        this.id === 'python'
          ? `raise BaseException(${payload})`
          : `throw [${payload}];`
      );
    }

    tryStatement(statement) {
      if (this.id === 'cpp') {
        if (statement.finalizer || statement.success) {
          throw new Error('C++ exception cleanup needs control-flow lowering');
        }
        this.openBlock('try');
        this.body(statement.body);
        this.closeBlock();
        for (const handler of statement.handlers) {
          const parameter = handler.type
            ? `${this.type(handler.type)} ${handler.name ?? ''}`.trim()
            : '...';
          this.openBlock(`catch (${parameter})`);
          this.body(handler.body);
          this.closeBlock();
        }
        return;
      }
      this.openBlock('try');
      this.body(statement.body);
      this.closeBlock();
      if (statement.handlers.length) {
        this.handlers(statement.handlers);
      }
      if (statement.success) {
        if (this.id !== 'python') {
          throw new Error(
            'Exception success blocks need control-flow lowering'
          );
        }
        this.openBlock('else');
        this.body(statement.success);
        this.closeBlock();
      }
      if (statement.finalizer) {
        this.openBlock('finally');
        this.body(statement.finalizer);
        this.closeBlock();
      }
    }

    main(program) {
      let returns = false;
      walk(program.main, (item) => {
        if (item.kind === 'Return') {
          returns = true;
        }
      });
      if (!returns || this.syntax.entryPoint !== 'top-level') {
        return super.main(program);
      }
      if (!['python', 'javascript', 'typescript'].includes(this.id)) {
        throw new Error(
          `Returning from a program entry point is unavailable for ${this.id}`
        );
      }
      const name = this.freshExceptionName('main');
      for (const text of program.mainComments ?? []) {
        this.comment(text);
      }
      this.openBlock(
        this.id === 'python' ? `def ${name}()` : `function ${name}()`
      );
      this.body(program.main);
      this.line(this.id === 'python' ? 'return 0' : 'return 0;');
      this.closeBlock();
      this.line();
      this.line(
        this.id === 'python'
          ? `raise SystemExit(${name}())`
          : `process.exit(${name}());`
      );
    }
  };
