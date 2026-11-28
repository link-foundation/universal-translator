import { walk } from '../meta/tree.js';
import { objpakRuntime } from './objpak-runtime.js';
import { objpakExpression } from './objpak-expressions.js';

export const withObjpakWriter = (Base) =>
  class extends Base {
    program(program) {
      const used = new Set();
      walk(program, (current) => {
        if (current.name) {
          used.add(current.name);
        }
        if (current.variable) {
          used.add(current.variable);
        }
        if (current.kind === 'Call') {
          used.add(current.callee.split('.')[0]);
        }
      });
      this.objpakNativeCount = 'utNativeCount';
      while (used.has(this.objpakNativeCount)) {
        this.objpakNativeCount += '_';
      }
      this.objpakNativeArgs = 'utNativeArgs';
      while (used.has(this.objpakNativeArgs)) {
        this.objpakNativeArgs += '_';
      }
      this.objpakHasArguments = false;
      walk(program, (current) => {
        if (current.kind === 'ProcessArguments') {
          this.objpakHasArguments = true;
        }
      });
      this.objpakTextObjects = new Set();
      this.objpakName = 'UtObjpakSet';
      while (used.has(this.objpakName)) {
        this.objpakName += '_';
      }
      return super.program(program);
    }

    expression(expression, parent = 0) {
      return (
        objpakExpression(this, expression) ??
        super.expression(expression, parent)
      );
    }

    forEachLoop(statement) {
      if (this.syntax.id === 'objc' && statement.array.type === 'set<text>') {
        this.line(
          `[${this.expression(statement.array)} do:{ :${this.variable(statement.variable)} |`
        );
        this.depth++;
        const previous = this.objpakTextObjects;
        this.objpakTextObjects = new Set(previous).add(statement.variable);
        this.body(statement.body);
        this.objpakTextObjects = previous;
        this.depth--;
        this.line('}];');
        return;
      }
      if (this.id === 'rust' && statement.array.type === 'set<text>') {
        this.openBlock(
          `for ${this.variable(statement.variable)} in ${this.expression(statement.array)}.iter()`
        );
        this.body(statement.body);
        this.closeBlock();
        return;
      }
      return super.forEachLoop(statement);
    }

    mainHeader() {
      return this.syntax.id === 'objc' && this.objpakHasArguments
        ? `int main(int ${this.objpakNativeCount}, char **${this.objpakNativeArgs})`
        : super.mainHeader();
    }
    main(program) {
      if (this.syntax.id !== 'objc') {
        return super.main(program);
      }
      this.comments(program, 'mainComments');
      this.openBlock(this.mainHeader());
      this.body(program.main);
      // POC compiles as C89, where falling off main has no defined exit status.
      this.line('return 0;');
      this.closeBlock();
    }
    declaration(statement) {
      if (
        this.syntax.id === 'objc' &&
        ['set<text>', 'array<text>'].includes(statement.type)
      ) {
        return `id ${this.variable(statement.name)} = ${this.expression(statement.value)};`;
      }
      return super.declaration(statement);
    }
    prelude(program) {
      const lines = super.prelude(program);
      if (
        this.syntax.id === 'objc' &&
        (this.uses.has('objpak') || this.uses.has('objpak-set'))
      ) {
        lines.push('#include <objpak.h>', '');
      }
      if (this.uses.has('objpak-set')) {
        lines.push(
          ...objpakRuntime[this.syntax.id]
            .replaceAll('$SET$', this.objpakName)
            .trimEnd()
            .split('\n'),
          ''
        );
      }
      return lines;
    }
  };
