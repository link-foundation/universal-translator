import { walk } from '../meta/tree.js';

const localKinds = new Set([
  'Assignment',
  'Binary',
  'Blank',
  'Block',
  'Boolean',
  'Catch',
  'Comment',
  'CountingLoop',
  'Declaration',
  'Evaluate',
  'If',
  'Name',
  'Number',
  'Return',
  'Throw',
  'Try',
  'Unary',
  'While',
]);
const scalarTypes = new Set(['integer', 'boolean', 'real']);
const nonMatching = new Set([
  'bool',
  'char',
  'double',
  'float',
  'long',
  'short',
]);

function intHandler(handlers) {
  let selected;
  for (const handler of handlers) {
    if (handler.cppType === 'int' || handler.cppType === '...') {
      selected ??= handler;
    } else if (!nonMatching.has(handler.cppType)) {
      throw new Error('C exception lowering requires a known C++ catch type');
    }
  }
  return selected;
}

// A branch to the dispatch label leaves only scopes that hold scalar locals.
// C++ calls and objects would need separate exception and cleanup handling.
function validateProtectedBlock(block) {
  walk(block, (item) => {
    if (
      !localKinds.has(item.kind) ||
      (item.kind === 'Declaration' && !scalarTypes.has(item.type))
    ) {
      throw new Error(`C exception lowering cannot unwind ${item.kind}`);
    }
  });
}

export const withCExceptions = (Base) =>
  class extends Base {
    cExceptionStatement(statement) {
      if (statement.kind === 'Try') {
        this.cTryStatement(statement);
        return;
      }
      const target = this.cExceptionTarget;
      if (!target) {
        throw new Error(
          'C exception lowering requires a local matching handler'
        );
      }
      let value = this.cActiveException;
      if (statement.value) {
        if (statement.cppType !== 'int') {
          throw new Error(
            'C exception lowering requires a portable C++ int literal'
          );
        }
        value = this.expression(statement.value);
      }
      if (!value) {
        throw new Error('C rethrow requires an active local exception');
      }
      this.line(`${target.payload} = ${value};`);
      this.line(`${target.raised} = 1;`);
      this.line(`goto ${target.dispatch};`);
    }

    cTryStatement({ body, handlers, success, finalizer }) {
      if (success || finalizer) {
        throw new Error(
          'C exception lowering requires explicit cleanup control flow'
        );
      }
      const handler = intHandler(handlers);
      const outerTarget = this.cExceptionTarget;
      if (!outerTarget) {
        validateProtectedBlock(body);
      }
      this.openBlock('');
      if (!handler) {
        this.body(body);
        this.closeBlock();
        return;
      }
      const payload = this.freshExceptionName('payload');
      const raised = this.freshExceptionName('raised');
      const dispatch = this.freshExceptionName('dispatch');
      this.line(`int ${payload} = 0;`);
      this.line(`int ${raised} = 0;`);
      this.openBlock('');
      this.cExceptionTarget = { payload, raised, dispatch };
      try {
        this.body(body);
      } finally {
        this.cExceptionTarget = outerTarget;
      }
      this.closeBlock();
      this.line(`goto ${dispatch};`);
      this.line(`${dispatch}:`);
      this.openBlock(`if (${raised})`);
      if (handler.name) {
        this.line(`int ${handler.name} = ${payload};`);
      }
      const outerActive = this.cActiveException;
      this.cActiveException = payload;
      try {
        this.body(handler.body);
      } finally {
        this.cActiveException = outerActive;
      }
      this.closeBlock();
      this.closeBlock();
    }
  };
