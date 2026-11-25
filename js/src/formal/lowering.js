// Lower a typed meta program to a small stack machine, then write that
// machine code as x86-64 assembly (NASM), CIL (ILAsm) or JVM bytecode
// (Jasmin).
//
// The stack machine has these instructions:
//
//   push n          load slot        store slot       pop
//   arithmetic op   (add subtract multiply divide remainder negate)
//   label L         jump L           compare-jump relation L
//   call name count return           return-nothing
//   print-integer   print-text value print-newline
//   comment text
//   new-array       (length, fill → array)       dup
//   element-index   (makes the integer on top an element index)
//   load-element    (array, index → value)       store-element (array,
//   array-length    (array → length)                 index, value → )
//
// Integers are 64-bit. Text exists only as literal parts of printed values,
// so every program that prints text, integers and their interpolations and
// computes with integer functions, loops and conditions can be lowered.
// Arrays of integers live in local slots; an array literal is a new array
// of zeros whose elements are stored one by one.

const relations = [
  'equal',
  'notEqual',
  'less',
  'lessOrEqual',
  'greater',
  'greaterOrEqual',
];

const opposite = {
  equal: 'notEqual',
  notEqual: 'equal',
  less: 'greaterOrEqual',
  lessOrEqual: 'greater',
  greater: 'lessOrEqual',
  greaterOrEqual: 'less',
};

const arithmetic = {
  add: 'add',
  subtract: 'subtract',
  multiply: 'multiply',
  divide: 'divide',
  integerDivide: 'divide',
  remainder: 'remainder',
};

const compoundOperators = {
  '+=': 'add',
  '-=': 'subtract',
  '*=': 'multiply',
  '/=': 'divide',
  '%=': 'remainder',
};

// How much each instruction changes the stack depth.
const stackEffect = {
  push: 1,
  load: 1,
  store: -1,
  pop: -1,
  arithmetic: -1,
  negate: 0,
  'compare-jump': -2,
  return: -1,
  'print-integer': -1,
  'new-array': -1,
  dup: 1,
  'load-element': -1,
  'store-element': -3,
};

function unsupported(what) {
  return new Error(`Machine targets cannot lower ${what}`);
}

class FunctionLowering {
  constructor(name, parameters, returns, functions) {
    this.name = name;
    this.returns = returns;
    this.functions = functions;
    this.slots = new Map(
      parameters.map(({ name: item }, index) => [item, index])
    );
    this.parameterCount = parameters.length;
    this.arrays = new Set();
    this.code = [];
    this.labels = 0;
    this.depth = 0;
    this.maxDepth = 0;
  }

  emit(operation, ...operands) {
    this.code.push([operation, ...operands]);
    const effect =
      operation === 'call'
        ? 1 - operands[1] - (this.functions.get(operands[0]).returns ? 0 : 1)
        : (stackEffect[operation] ?? 0);
    this.depth += effect;
    this.maxDepth = Math.max(this.maxDepth, this.depth);
  }

  label() {
    this.labels += 1;
    return `L${this.labels}`;
  }

  slot(name) {
    if (!this.slots.has(name)) {
      this.slots.set(name, this.slots.size);
    }
    return this.slots.get(name);
  }

  known(name) {
    if (!this.slots.has(name)) {
      throw new Error(`"${name}" is used before it is declared`);
    }
    return this.slots.get(name);
  }

  block(node) {
    for (const statement of node.statements) {
      this.statement(statement);
    }
  }

  statement(node) {
    const lower = this[`lower${node.kind}`];
    if (!lower) {
      throw unsupported(`the ${node.kind} statement`);
    }
    lower.call(this, node);
  }

  lowerComment(node) {
    for (const line of node.text.split('\n')) {
      this.emit('comment', line);
    }
  }

  // Machine code has no layout to keep.
  lowerBlank() {}

  lowerDeclaration(node) {
    const isArray =
      node.type === 'array' ||
      ['ArrayLiteral', 'NewArray'].includes(node.value?.kind);
    this.value(node.value);
    if (isArray) {
      this.arrays.add(node.name);
    }
    this.emit('store', this.slot(node.name));
  }

  lowerIndexAssignment(node) {
    this.emit('load', this.known(node.name));
    this.value(node.index);
    this.emit('element-index');
    this.value(node.value);
    this.emit('store-element');
  }

  // [a, b] is a new array of two zeros whose elements become a and b.
  arrayLiteral(node) {
    this.emit('push', node.elements.length);
    this.emit('push', 0);
    this.emit('new-array');
    node.elements.forEach((element, index) => {
      this.emit('dup');
      this.emit('push', index);
      this.emit('element-index');
      this.value(element);
      this.emit('store-element');
    });
  }

  lowerAssignment(node) {
    const slot = this.known(node.name);
    if (node.operator === '=') {
      this.value(node.value);
    } else if (compoundOperators[node.operator]) {
      this.emit('load', slot);
      this.value(node.value);
      this.emit('arithmetic', compoundOperators[node.operator]);
    } else {
      throw unsupported(`the ${node.operator} assignment`);
    }
    this.emit('store', slot);
  }

  lowerIf(node) {
    const otherwise = this.label();
    const done = this.label();
    this.whenFalse(node.condition, otherwise);
    this.block(node.then);
    this.emit('jump', done);
    this.emit('label', otherwise);
    if (node.otherwise) {
      this.statementOrBlock(node.otherwise);
    }
    this.emit('label', done);
  }

  statementOrBlock(node) {
    if (node.kind === 'Block') {
      this.block(node);
    } else {
      this.statement(node);
    }
  }

  lowerWhile(node) {
    const top = this.label();
    const done = this.label();
    this.emit('label', top);
    this.whenFalse(node.condition, done);
    this.block(node.body);
    this.emit('jump', top);
    this.emit('label', done);
  }

  lowerCountingLoop(node) {
    const slot = this.slot(node.variable);
    const top = this.label();
    const done = this.label();
    this.value(node.start);
    this.emit('store', slot);
    this.emit('label', top);
    this.emit('load', slot);
    this.value(node.end);
    this.emit('compare-jump', 'greaterOrEqual', done);
    this.block(node.body);
    this.emit('load', slot);
    this.emit('push', 1);
    this.emit('arithmetic', 'add');
    this.emit('store', slot);
    this.emit('jump', top);
    this.emit('label', done);
  }

  lowerReturn(node) {
    if (node.value) {
      this.value(node.value);
      this.emit('return');
    } else {
      this.emit('return-nothing');
    }
  }

  lowerPrint(node) {
    const parts =
      node.value.kind === 'Interpolation' ? node.value.parts : [node.value];
    for (const part of parts) {
      if (part.kind === 'Text') {
        if (part.value) {
          this.emit('print-text', part.value);
        }
      } else if (part.type === 'integer') {
        this.value(part);
        this.emit('print-integer');
      } else {
        throw unsupported(`printing a ${part.type ?? 'untyped'} value`);
      }
    }
    if (node.newline) {
      this.emit('print-newline');
    }
  }

  lowerEvaluate(node) {
    this.value(node.expression);
    if (node.expression.kind !== 'Call' || this.returnsValue(node.expression)) {
      this.emit('pop');
    }
  }

  returnsValue(call) {
    return this.functions.get(call.callee)?.returns;
  }

  // Push the value of an integer or boolean expression.
  value(node) {
    switch (node.kind) {
      case 'Number':
        if (!Number.isInteger(node.value)) {
          throw unsupported(`the number ${node.value}`);
        }
        this.emit('push', node.value);
        return;
      case 'Boolean':
        this.emit('push', node.value ? 1 : 0);
        return;
      case 'Name':
        this.emit('load', this.known(node.name));
        return;
      case 'Call':
        this.call(node);
        return;
      case 'Unary':
        return this.unary(node);
      case 'Binary':
        return this.binary(node);
      case 'ArrayLiteral':
        return this.arrayLiteral(node);
      case 'NewArray':
        this.value(node.length);
        this.value(node.fill);
        this.emit('new-array');
        return;
      case 'Index':
        this.value(node.array);
        this.value(node.index);
        this.emit('element-index');
        this.emit('load-element');
        return;
      case 'Length':
        this.value(node.array);
        this.emit('array-length');
        return;
      default:
        throw unsupported(`a ${node.kind} value`);
    }
  }

  call(node) {
    const callee = this.functions.get(node.callee);
    if (!callee) {
      throw unsupported(`a call to the unknown function "${node.callee}"`);
    }
    for (const argument of node.arguments) {
      this.value(argument);
    }
    this.emit('call', node.callee, node.arguments.length);
  }

  unary(node) {
    if (node.operator === 'negate') {
      this.value(node.operand);
      this.emit('negate');
    } else {
      this.booleanValue(node);
    }
  }

  binary(node) {
    if (arithmetic[node.operator]) {
      this.value(node.left);
      this.value(node.right);
      this.emit('arithmetic', arithmetic[node.operator]);
    } else {
      this.booleanValue(node);
    }
  }

  // A condition used as a value becomes 1 or 0.
  booleanValue(node) {
    const otherwise = this.label();
    const done = this.label();
    this.whenFalse(node, otherwise);
    this.emit('push', 1);
    this.emit('jump', done);
    this.emit('label', otherwise);
    this.depth -= 1;
    this.emit('push', 0);
    this.emit('label', done);
  }

  // Jump to the label when the condition is false; fall through otherwise.
  whenFalse(node, target) {
    this.branch(node, target, false);
  }

  branch(node, target, jumpWhen) {
    if (node.kind === 'Binary' && relations.includes(node.operator)) {
      this.value(node.left);
      this.value(node.right);
      this.emit(
        'compare-jump',
        jumpWhen ? node.operator : opposite[node.operator],
        target
      );
    } else if (node.kind === 'Unary' && node.operator === 'not') {
      this.branch(node.operand, target, !jumpWhen);
    } else if (
      node.kind === 'Binary' &&
      ['and', 'or'].includes(node.operator)
    ) {
      // "a and b" is false when either part is false; "a or b" is true when
      // either part is true. Otherwise the second part decides.
      const shortCircuit = (node.operator === 'and') !== jumpWhen;
      if (shortCircuit) {
        this.branch(node.left, target, jumpWhen);
        this.branch(node.right, target, jumpWhen);
      } else {
        const skip = this.label();
        this.branch(node.left, skip, !jumpWhen);
        this.branch(node.right, target, jumpWhen);
        this.emit('label', skip);
      }
    } else {
      this.value(node);
      this.emit('push', 0);
      this.emit('compare-jump', jumpWhen ? 'notEqual' : 'equal', target);
    }
  }

  finish(comments = []) {
    const last = this.code.at(-1)?.[0];
    if (!this.returns && last !== 'return-nothing') {
      this.emit('return-nothing');
    }
    return {
      name: this.name,
      parameterCount: this.parameterCount,
      slotCount: this.slots.size,
      slotNames: [...this.slots.keys()],
      slotTypes: [...this.slots.keys()].map((name) =>
        this.arrays.has(name) ? 'array' : 'integer'
      ),
      returns: this.returns,
      maxDepth: this.maxDepth,
      comments,
      code: this.code,
    };
  }
}

// Lower a typed meta program (after the context rules) to stack machine code.
export function lowerProgram(program) {
  const functions = new Map(
    program.functions.map((item) => [
      item.name,
      { returns: item.returnType && item.returnType !== 'nothing' },
    ])
  );
  for (const item of program.functions) {
    if (item.returnType === 'array') {
      throw unsupported(`the array returned by "${item.name}"`);
    }
    for (const parameter of item.parameters) {
      if (parameter.type && parameter.type !== 'integer') {
        throw unsupported(
          `the ${parameter.type} parameter "${parameter.name}"`
        );
      }
    }
  }
  const lowered = program.functions.map((item) => {
    const lowering = new FunctionLowering(
      item.name,
      item.parameters,
      functions.get(item.name).returns,
      functions
    );
    lowering.block(item.body);
    return lowering.finish(item.comments);
  });
  const main = new FunctionLowering('main', [], false, functions);
  main.block(program.main);
  return {
    comments: program.comments ?? [],
    functions: lowered,
    main: main.finish(program.mainComments),
  };
}
