// WebAssembly text (WAT) written from the stack machine code of lowering.js.
// Every value is an i64; an array is the address of its first element, with
// its length in the eight bytes before it. A label is a block that ends where
// its code starts, so a forward jump is a branch out of that block. A program
// with a backward jump runs inside a loop that re-enters the blocks through a
// br_table on the label number. A value on the stack at a jump or a label is
// kept in a "$.stack.N" local, because a block starts with an empty stack.
// The host provides print_integer, print_text and print_newline.

import {
  allFunctions,
  mapInstructions,
  renderMachine,
  comments,
  createsArrays,
  hex,
  labelNames,
  printable,
  returnsByName,
  utf8,
} from './machine-shared.js';

const watRelations = {
  equal: 'i64.eq',
  notEqual: 'i64.ne',
  less: 'i64.lt_s',
  lessOrEqual: 'i64.le_s',
  greater: 'i64.gt_s',
  greaterOrEqual: 'i64.ge_s',
};
const watArithmetic = {
  add: 'i64.add',
  subtract: 'i64.sub',
  multiply: 'i64.mul',
  divide: 'i64.div_s',
  remainder: 'i64.rem_s',
};

// How much each instruction changes the stack depth.
const stackEffect = {
  push: 1,
  load: 1,
  store: -1,
  pop: -1,
  arithmetic: -1,
  'compare-jump': -2,
  return: -1,
  'print-integer': -1,
  'new-array': -1,
  dup: 1,
  'load-element': -1,
  'store-element': -3,
};

// The bytes of a string literal: printable ASCII stays readable, the other
// bytes are hexadecimal escapes.
export function watText(text) {
  const body = utf8(text)
    .map((byte) =>
      printable(byte) ? String.fromCharCode(byte) : `\\${hex(byte)}`
    )
    .join('');
  return `"${body}"`;
}

const spillLines = (depth) =>
  Array.from({ length: depth }, (_, index) => depth - 1 - index).map(
    (index) => `local.set $.stack.${index}`
  );
const reload = (depth) =>
  Array.from({ length: depth }, (_, index) => `local.get $.stack.${index}`);

// A jump to a label before the code that is being written needs the loop.
function hasBackwardJump(item) {
  const labels = labelNames(item);
  let section = 0;
  return item.code.some(([operation, ...operands]) => {
    if (operation === 'label') {
      section += 1;
    }
    const target = operation === 'jump' ? operands[0] : operands[1];
    return (
      ['jump', 'compare-jump'].includes(operation) &&
      labels.indexOf(target) + 1 <= section
    );
  });
}

const simple = {
  push: ([value]) => [`i64.const ${value}`],
  pop: () => ['drop'],
  arithmetic: ([name]) => [watArithmetic[name]],
  negate: () => ['i64.const -1', 'i64.xor', 'i64.const 1', 'i64.add'],
  call: ([name]) => [`call $${name}`],
  'print-integer': () => ['call $print_integer'],
  'print-newline': () => ['call $print_newline'],
  'new-array': () => ['call $new_array'],
  dup: () => ['local.tee $.dup', 'local.get $.dup'],
  'element-index': () => ['i64.const 3', 'i64.shl'],
  'load-element': () => ['i64.add', 'i32.wrap_i64', 'i64.load'],
  'store-element': () => [
    'local.set $.value',
    'i64.add',
    'i32.wrap_i64',
    'local.get $.value',
    'i64.store',
  ],
  'array-length': () => ['i64.const 8', 'i64.sub', 'i32.wrap_i64', 'i64.load'],
};

class WatFunction {
  constructor(item, calls, text) {
    this.item = item;
    this.calls = calls;
    this.text = text;
    this.labels = labelNames(item);
    this.dispatch = hasBackwardJump(item);
    this.body = [];
    this.depth = 0;
    this.spilled = 0;
    this.terminated = false;
    this.section = 0;
    this.labelDepths = new Map();
    this.helpers = new Set();
  }

  // Lines that move the stack into its locals.
  spill(depth) {
    this.spilled = Math.max(this.spilled, depth);
    return spillLines(depth);
  }

  add(...lines) {
    this.body.push(...lines.map((line) => `    ${line}`));
  }

  change(effect) {
    this.depth = Math.max(0, this.depth + effect);
  }

  number(label) {
    return this.labels.indexOf(label) + 1;
  }

  // Where a jump to the label with the stack as it is now ends up.
  recordDepth(label) {
    if (!this.labelDepths.has(label)) {
      this.labelDepths.set(label, this.depth);
    }
  }

  backward(label) {
    this.helpers.add('.pc');
    return [
      `i32.const ${this.number(label)}`,
      'local.set $.pc',
      'br $dispatch',
    ];
  }

  jump(label) {
    this.recordDepth(label);
    const forward = this.number(label) > this.section;
    this.add(
      ...this.spill(this.depth),
      ...(forward ? [`br $${label}`] : this.backward(label))
    );
    this.terminated = true;
  }

  compareJump(relation, label) {
    this.change(-2);
    const { depth } = this;
    this.recordDepth(label);
    const kept = depth > 0;
    if (kept) {
      this.helpers.add('.cond');
    }
    const condition = kept ? ['local.get $.cond'] : [];
    this.add(
      watRelations[relation],
      ...(kept ? ['local.set $.cond', ...this.spill(depth)] : [])
    );
    if (this.number(label) > this.section) {
      this.add(...reload(depth), ...condition, `br_if $${label}`);
    } else {
      this.add(
        ...condition,
        'if',
        ...this.backward(label),
        'end',
        ...reload(depth)
      );
    }
  }

  label(name) {
    if (!this.terminated) {
      this.recordDepth(name);
      this.add(...this.spill(this.depth));
    }
    this.add(`end ;; ${name}`);
    this.section += 1;
    this.depth = this.labelDepths.get(name) ?? 0;
    this.add(...reload(this.depth));
    this.terminated = false;
  }

  printText(text) {
    const { offset, length } = this.text(text);
    this.add(`i32.const ${offset}`, `i32.const ${length}`, 'call $print_text');
  }

  instruction(operation, operands) {
    const slotName = (slot) => `$${this.item.slotNames[slot]}`;
    const special = {
      comment: ([text]) => this.add(...comments(';;', [text])),
      load: ([slot]) => this.add(`local.get ${slotName(slot)}`),
      store: ([slot]) => this.add(`local.set ${slotName(slot)}`),
      label: ([name]) => this.label(name),
      jump: ([name]) => this.jump(name),
      'compare-jump': ([relation, name]) => this.compareJump(relation, name),
      return: () => this.add('return'),
      'return-nothing': () => this.add('return'),
      'print-text': ([text]) => this.printText(text),
    };
    if (special[operation]) {
      special[operation](operands);
    } else {
      if (['dup', 'store-element'].includes(operation)) {
        this.helpers.add(operation === 'dup' ? '.dup' : '.value');
      }
      this.add(...simple[operation](operands));
    }
    if (operation === 'call') {
      this.change(1 - operands[1] - (this.calls.get(operands[0]) ? 0 : 1));
    } else {
      this.change(stackEffect[operation] ?? 0);
    }
    if (['return', 'return-nothing'].includes(operation)) {
      this.terminated = true;
    }
  }

  opening() {
    const names = [...this.labels].reverse().map((name) => `block $${name}`);
    if (!this.dispatch) {
      return names;
    }
    const targets = ['$start', ...this.labels.map((name) => `$${name}`)];
    return [
      'loop $dispatch',
      ...names,
      'block $start',
      'local.get $.pc',
      `br_table ${targets.join(' ')} $start`,
      'end ;; start',
    ];
  }

  declarations() {
    const { item } = this;
    const types = { '.pc': 'i32', '.cond': 'i32' };
    const helpers = ['.pc', '.cond', '.dup', '.value']
      .filter((name) => this.helpers.has(name))
      .map((name) => `(local $${name} ${types[name] ?? 'i64'})`);
    return [
      ...item.slotNames
        .slice(item.parameterCount)
        .map((name) => `(local $${name} i64)`),
      ...helpers,
      ...Array.from(
        { length: this.spilled },
        (_, index) => `(local $.stack.${index} i64)`
      ),
    ];
  }

  write() {
    const { item } = this;
    const prologue = this.opening();
    for (const instruction of item.code) {
      const [operation, ...operands] = instruction;
      const start = this.body.length;
      this.instruction(operation, operands);
      mapInstructions(this.body, instruction, start);
    }
    const last = item.code.at(-1)?.[0];
    const needsEnd = item.returns && (this.dispatch || last !== 'return');
    const parameters = item.slotNames
      .slice(0, item.parameterCount)
      .map((name) => ` (param $${name} i64)`)
      .join('');
    const result = item.returns ? ' (result i64)' : '';
    const exported = item.name === 'main' ? ' (export "main")' : '';
    return [
      ...comments(';;', item.comments, '  '),
      `  (func $${item.name}${exported}${parameters}${result}`,
      ...this.declarations().map((line) => `    ${line}`),
      ...prologue.map((line) => `    ${line}`),
      ...this.body,
      ...(this.dispatch ? ['    end ;; dispatch'] : []),
      ...(needsEnd ? ['    unreachable'] : []),
      '  )',
    ];
  }
}

// new_array(length, fill): the next free memory holds the length and then the
// elements; the memory is never freed. It returns the address of the first
// element.
const watNewArray = [
  '  (func $new_array (param $length i64) (param $fill i64) (result i64)',
  '    (local $block i32)',
  '    (local $index i64)',
  '    global.get $heap',
  '    local.set $block',
  '    global.get $heap',
  '    local.get $length',
  '    i32.wrap_i64',
  '    i32.const 3',
  '    i32.shl',
  '    i32.const 8',
  '    i32.add',
  '    i32.add',
  '    global.set $heap',
  '    local.get $block',
  '    local.get $length',
  '    i64.store',
  '    loop $fill',
  '      local.get $index',
  '      local.get $length',
  '      i64.lt_s',
  '      if',
  '        local.get $block',
  '        local.get $index',
  '        i32.wrap_i64',
  '        i32.const 3',
  '        i32.shl',
  '        i32.add',
  '        local.get $fill',
  '        i64.store offset=8',
  '        local.get $index',
  '        i64.const 1',
  '        i64.add',
  '        local.set $index',
  '        br $fill',
  '      end',
  '    end',
  '    local.get $block',
  '    i32.const 8',
  '    i32.add',
  '    i64.extend_i32_u',
  '  )',
];

export function writeWat(program) {
  const texts = new Map();
  let size = 0;
  const text = (value) => {
    if (!texts.has(value)) {
      const length = utf8(value).length;
      texts.set(value, { offset: size, length });
      size += length;
    }
    return texts.get(value);
  };
  const calls = returnsByName(program);
  const functions = allFunctions(program).map((item) =>
    new WatFunction(item, calls, text).write()
  );
  const arrays = createsArrays(program);
  const heap = Math.ceil(size / 8) * 8;
  return renderMachine(
    [
      ...comments(';;', program.comments),
      ...(program.comments.length ? [''] : []),
      '(module',
      '  (import "env" "print_integer" (func $print_integer (param i64)))',
      '  (import "env" "print_text" (func $print_text (param i32 i32)))',
      '  (import "env" "print_newline" (func $print_newline))',
      '  (memory (export "memory") 256)',
      ...[...texts].map(
        ([value, { offset }]) =>
          `  (data (i32.const ${offset}) ${watText(value)})`
      ),
      ...(arrays ? [`  (global $heap (mut i32) (i32.const ${heap}))`] : []),
      '',
      ...functions.flatMap((lines, index) => [
        ...(index ? [''] : []),
        ...lines,
      ]),
      ...(arrays ? ['', ...watNewArray] : []),
      ')',
      '',
    ],
    'wat'
  );
}
