// Objective-C messages and Portable Object Compiler block expressions keep
// their receiver, selector and arguments until the library rules interpret them.
import { block, node } from '../../meta/tree.js';

// Both runtimes define BOOL and YES/NO; their object ABIs differ.
export const objectiveCRuntimeHeader =
  '#ifdef __PORTABLE_OBJC__\n#include <objcrt.h>\n#else\n#import <objc/objc.h>\n#endif';

export const objc = {
  parser: (Base) =>
    class extends Base {
      skipNewlines() {
        while (this.peek().type === 'newline') {
          this.next();
        }
      }

      primary() {
        if (this.accept('[')) {
          this.skipNewlines();
          const receiver = this.expression();
          this.skipNewlines();
          let selector = this.expectName();
          const args = [];
          if (this.accept(':')) {
            selector += ':';
            for (;;) {
              this.skipNewlines();
              args.push(this.expression());
              this.skipNewlines();
              if (!this.is(':', 1)) {
                break;
              }
              selector += `${this.expectName()}:`;
              this.expect(':');
            }
          }
          this.expect(']');
          return node('Message', { receiver, selector, arguments: args });
        }
        if (this.is('{') && this.is(':', 1)) {
          this.next();
          const parameters = [];
          while (this.accept(':')) {
            parameters.push(this.expectName());
          }
          this.expect('|');
          const body = block(this.items(() => this.is('}')));
          this.expect('}');
          return node('BlockLambda', { parameters, body });
        }
        return super.primary();
      }

      unary() {
        if (this.accept('*')) {
          return node('Dereference', { operand: this.unary() });
        }
        if (this.is('++') || this.is('--')) {
          const delta = this.next().value === '++' ? 1 : -1;
          return node('Update', { operand: this.unary(), delta, prefix: true });
        }
        return super.unary();
      }

      postfix() {
        const operand = super.postfix();
        if (this.is('++') || this.is('--')) {
          const delta = this.next().value === '++' ? 1 : -1;
          return node('Update', { operand, delta, prefix: false });
        }
        return operand;
      }

      whileStatement() {
        this.next();
        const condition = this.condition();
        this.skipNewlines();
        const body = this.is('{') ? this.block() : block([this.statement()]);
        return node('While', { condition, body });
      }
    },
};
