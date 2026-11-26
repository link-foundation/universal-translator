// Runtime carriers and typed handler dispatch.
export const exceptionMarker = 'universal-translator:throw';
const marker = exceptionMarker;
export const withExceptionHandlers = (Base) =>
  class extends Base {
    handlers(handlers) {
      const python = this.id === 'python';
      const error = this.freshExceptionName('error');
      const payload = this.freshExceptionName('value');
      const tag = this.freshExceptionName('type');
      this.openBlock(
        python ? `except BaseException as ${error}` : `catch (${error})`
      );
      this.unpackException(error, payload, tag);
      this.dispatchHandlers(handlers, error, payload, tag);
      this.closeBlock();
    }

    unpackException(error, payload, tag) {
      const python = this.id === 'python';
      const carrier = python
        ? `type(${error}) == BaseException and len(${error}.args) == 3 and ${error}.args[0] == ${this.quote(marker)}`
        : `Array.isArray(${error}) && ${error}.length === 3 && ${error}[0] === ${this.quote(marker)}`;
      if (!python) {
        this.line(`let ${payload} = ${error};`);
        this.line(`let ${tag} = "";`);
      }
      this.openBlock(`if ${python ? carrier : `(${carrier})`}`);
      this.line(
        `${payload} = ${error}${python ? '.args' : ''}[2]${this.terminator()}`
      );
      this.line(
        `${tag} = ${error}${python ? '.args' : ''}[1]${this.terminator()}`
      );
      this.closeBlock();
      if (python) {
        this.openBlock('else');
        this.line(`${payload} = ${error}`);
        this.line(`${tag} = ""`);
        this.closeBlock();
      }
    }

    dispatchHandlers(handlers, error, payload, tag) {
      const python = this.id === 'python';
      let guarded = false;
      let catchesAll = false;
      for (const handler of handlers) {
        if (catchesAll) {
          throw new Error('A catch-all handler must be last');
        }
        const guard = this.catchGuard(handler.type, payload, tag);
        if (guard) {
          this.openBlock(
            `${guarded ? (python ? 'elif' : 'else if') : 'if'} ${python ? guard : `(${guard})`}`
          );
          guarded = true;
        } else {
          if (guarded) {
            this.openBlock('else');
          }
          catchesAll = true;
        }
        if (handler.name) {
          this.line(
            `${python ? '' : 'let '}${handler.name} = ${payload}${this.terminator()}`
          );
        }
        const previous = this.activeException;
        this.activeException = error;
        this.body(handler.body);
        this.activeException = previous;
        if (guard || guarded) {
          this.closeBlock();
        }
      }
      if (!catchesAll) {
        this.openBlock('else');
        this.line(python ? 'raise' : `throw ${error};`);
        this.closeBlock();
      }
    }

    catchGuard(type, payload, tag) {
      if (!type) {
        return undefined;
      }
      if (type.startsWith('source:')) {
        const kind = this.type(type);
        return this.id === 'python'
          ? `isinstance(${payload}, ${kind})`
          : `${payload} instanceof ${kind}`;
      }
      return `${tag} ==${this.id === 'python' ? '' : '='} ${this.quote(type)}`;
    }
  };
