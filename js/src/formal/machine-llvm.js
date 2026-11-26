// LLVM IR (opaque pointers, LLVM 15 or later) written from the stack machine
// code of lowering.js. Every stack slot is an alloca, so the code stays in
// SSA form without phi nodes; the writer keeps the machine's stack as a list
// of operands, and a stack that is not empty at a jump or a label is saved
// in "%stack.N" allocas around it.

import {
  allFunctions,
  comments,
  createsArrays,
  hex,
  printable,
  returnsByName,
  utf8,
} from './machine-shared.js';

const llvmRelations = {
  equal: 'eq',
  notEqual: 'ne',
  less: 'slt',
  lessOrEqual: 'sle',
  greater: 'sgt',
  greaterOrEqual: 'sge',
};
const llvmArithmetic = {
  add: 'add',
  subtract: 'sub',
  multiply: 'mul',
  divide: 'sdiv',
  remainder: 'srem',
};

// A constant string and its size: printable ASCII stays readable, other
// bytes are hexadecimal escapes. Every string ends with a zero byte.
export function llvmText(text) {
  const bytes = utf8(text);
  const body = bytes
    .map((byte) =>
      printable(byte) ? String.fromCharCode(byte) : `\\${hex(byte)}`
    )
    .join('');
  return `[${bytes.length + 1} x i8] c"${body}\\00"`;
}

const printf = 'call i32 (ptr, ...) @printf';

class LlvmFunction {
  constructor(item, calls, texts) {
    this.item = item;
    this.calls = calls;
    this.texts = texts;
    this.lines = [];
    this.stack = [];
    this.temporaries = 0;
    this.blocks = 0;
    this.terminated = false;
    this.labelTypes = new Map();
    this.spilled = new Set();
  }

  temporary() {
    this.temporaries += 1;
    return `%t.${this.temporaries}`;
  }

  open(name) {
    this.lines.push(`${name}:`);
    this.terminated = false;
  }

  // An instruction after a branch or a return starts a block that nothing
  // jumps to.
  emit(line, terminates = false) {
    if (this.terminated) {
      this.blocks += 1;
      this.open(`dead.${this.blocks}`);
    }
    this.lines.push(`  ${line}`);
    this.terminated = terminates;
  }

  slotType(slot) {
    return this.item.slotTypes?.[slot] === 'array' ? 'ptr' : 'i64';
  }

  slotAddress(slot) {
    return `%${this.item.slotNames[slot]}.addr`;
  }

  spillAddress(type, index) {
    return type === 'ptr' ? `%stack.ptr.${index}` : `%stack.${index}`;
  }

  push(value, type = 'i64') {
    this.stack.push({ value, type, reload: -1 });
  }

  define(instruction, type = 'i64') {
    const result = this.temporary();
    this.emit(`${result} = ${instruction}`);
    this.push(result, type);
    return result;
  }

  pop() {
    return this.stack.pop().value;
  }

  // Save the stack in allocas so that a label can bring it back.
  save(label) {
    const types = this.stack.map(({ type }) => type);
    if (!this.labelTypes.has(label)) {
      this.labelTypes.set(label, types);
    }
    this.stack.forEach(({ value, type, reload }, index) => {
      if (reload !== index) {
        this.spilled.add(this.spillAddress(type, index));
        this.emit(
          `store ${type} ${value}, ptr ${this.spillAddress(type, index)}`
        );
      }
    });
  }

  restore(types) {
    this.stack = [];
    types.forEach((type, index) => {
      const result = this.temporary();
      this.emit(
        `${result} = load ${type}, ptr ${this.spillAddress(type, index)}`
      );
      this.stack.push({ value: result, type, reload: index });
    });
  }

  label(name) {
    let types = this.labelTypes.get(name) ?? [];
    if (!this.terminated) {
      this.save(name);
      types = this.labelTypes.get(name);
      this.emit(`br label %${name}`, true);
    }
    this.open(name);
    this.restore(types);
  }

  compareJump(relation, label) {
    const right = this.pop();
    const left = this.pop();
    const condition = this.temporary();
    this.emit(
      `${condition} = icmp ${llvmRelations[relation]} i64 ${left}, ${right}`
    );
    this.save(label);
    const types = this.stack.map(({ type }) => type);
    this.blocks += 1;
    const next = `next.${this.blocks}`;
    this.emit(`br i1 ${condition}, label %${label}, label %${next}`, true);
    this.open(next);
    this.restore(types);
  }

  call(name, count) {
    const values = this.stack.splice(this.stack.length - count);
    const arguments_ = values.map(({ value }) => `i64 ${value}`).join(', ');
    if (this.calls.get(name)) {
      this.define(`call i64 @${name}(${arguments_})`);
    } else {
      this.emit(`call void @${name}(${arguments_})`);
    }
  }

  element(array, index) {
    const address = this.temporary();
    this.emit(`${address} = getelementptr i64, ptr ${array}, i64 ${index}`);
    return address;
  }

  instruction(operation, operands) {
    const write = {
      comment: ([text]) => this.lines.push(...comments(';', [text], '  ')),
      push: ([value]) => this.push(String(value)),
      load: ([slot]) =>
        this.define(
          `load ${this.slotType(slot)}, ptr ${this.slotAddress(slot)}`,
          this.slotType(slot)
        ),
      store: ([slot]) =>
        this.emit(
          `store ${this.slotType(slot)} ${this.pop()}, ptr ${this.slotAddress(slot)}`
        ),
      pop: () => this.pop(),
      arithmetic: ([name]) => {
        const right = this.pop();
        const left = this.pop();
        this.define(`${llvmArithmetic[name]} i64 ${left}, ${right}`);
      },
      negate: () => this.define(`sub nsw i64 0, ${this.pop()}`),
      label: ([name]) => this.label(name),
      jump: ([name]) => {
        this.save(name);
        this.emit(`br label %${name}`, true);
      },
      'compare-jump': ([relation, name]) => this.compareJump(relation, name),
      call: ([name, count]) => this.call(name, count),
      return: () => this.emit(`ret i64 ${this.pop()}`, true),
      'return-nothing': () =>
        this.emit(this.item.name === 'main' ? 'ret i32 0' : 'ret void', true),
      'print-integer': () =>
        this.emit(`${printf}(ptr @integer_format, i64 ${this.pop()})`),
      'print-text': ([text]) =>
        this.emit(`${printf}(ptr @text_format, ptr @${this.texts(text)})`),
      'print-newline': () => this.emit(`${printf}(ptr @newline_format)`),
      'new-array': () => {
        const fill = this.pop();
        const length = this.pop();
        this.define(`call ptr @new_array(i64 ${length}, i64 ${fill})`, 'ptr');
      },
      dup: () => this.stack.push({ ...this.stack.at(-1), reload: -1 }),
      'element-index': () => {},
      'load-element': () => {
        const index = this.pop();
        const address = this.element(this.pop(), index);
        this.define(`load i64, ptr ${address}`);
      },
      'store-element': () => {
        const value = this.pop();
        const index = this.pop();
        const address = this.element(this.pop(), index);
        this.emit(`store i64 ${value}, ptr ${address}`);
      },
      'array-length': () => {
        const address = this.temporary();
        this.emit(`${address} = getelementptr i8, ptr ${this.pop()}, i64 -8`);
        this.define(`load i64, ptr ${address}`);
      },
    };
    write[operation](operands);
  }

  write() {
    const { item } = this;
    const isMain = item.name === 'main';
    for (const [operation, ...operands] of item.code) {
      this.instruction(operation, operands);
    }
    if (!this.terminated) {
      this.emit('unreachable', true);
    }
    const parameters = item.slotNames
      .slice(0, item.parameterCount)
      .map((name) => `i64 %${name}`)
      .join(', ');
    const result = isMain ? 'i32' : item.returns ? 'i64' : 'void';
    return [
      ...comments(';', item.comments),
      `define ${result} @${item.name}(${parameters}) {`,
      'entry.0:',
      ...item.slotNames.map(
        (name, slot) => `  %${name}.addr = alloca ${this.slotType(slot)}`
      ),
      ...[...this.spilled].map(
        (address) =>
          `  ${address} = alloca ${address.startsWith('%stack.ptr') ? 'ptr' : 'i64'}`
      ),
      ...item.slotNames
        .slice(0, item.parameterCount)
        .map((name) => `  store i64 %${name}, ptr %${name}.addr`),
      ...this.lines,
      '}',
    ];
  }
}

// new_array(length, fill): malloc room for the length and the elements,
// then fill them. The memory lives until the program ends.
const llvmNewArray = [
  'define private ptr @new_array(i64 %length, i64 %fill) {',
  'entry.0:',
  '  %bytes = shl i64 %length, 3',
  '  %size = add i64 %bytes, 8',
  '  %block = call ptr @malloc(i64 %size)',
  '  store i64 %length, ptr %block',
  '  %elements = getelementptr i64, ptr %block, i64 1',
  '  br label %fill.test',
  'fill.test:',
  '  %index = phi i64 [ 0, %entry.0 ], [ %next, %fill.body ]',
  '  %more = icmp slt i64 %index, %length',
  '  br i1 %more, label %fill.body, label %fill.done',
  'fill.body:',
  '  %address = getelementptr i64, ptr %elements, i64 %index',
  '  store i64 %fill, ptr %address',
  '  %next = add i64 %index, 1',
  '  br label %fill.test',
  'fill.done:',
  '  ret ptr %elements',
  '}',
  '',
];

export function writeLlvm(program) {
  const texts = new Map();
  const textName = (text) => {
    if (!texts.has(text)) {
      texts.set(text, `text.${texts.size}`);
    }
    return texts.get(text);
  };
  const calls = returnsByName(program);
  const functions = allFunctions(program).map((item) =>
    new LlvmFunction(item, calls, textName).write()
  );
  const constant = (name, text) =>
    `@${name} = private unnamed_addr constant ${llvmText(text)}`;
  return [
    ...comments(';', program.comments),
    ...(program.comments.length ? [''] : []),
    'declare i32 @printf(ptr, ...)',
    ...(createsArrays(program) ? ['declare ptr @malloc(i64)'] : []),
    '',
    constant('integer_format', '%lld'),
    constant('text_format', '%s'),
    constant('newline_format', '\n'),
    ...[...texts].map(([text, name]) => constant(name, text)),
    '',
    ...functions.flatMap((lines) => [...lines, '']),
    ...(createsArrays(program) ? llvmNewArray : []),
  ]
    .join('\n')
    .replace(/\n+$/, '\n');
}
