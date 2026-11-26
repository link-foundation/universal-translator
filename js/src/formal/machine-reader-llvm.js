// Read LLVM IR back into the stack machine code described in lowering.js.
// The IR keeps every stack slot in an alloca and every intermediate value in
// a temporary, so the reader rebuilds expression trees from the temporaries
// and writes them out in the order the stack machine evaluates them: operands
// first, then the operation. A temporary that is used more than once (an
// array literal being filled) stays on the stack, with a dup before each use
// but the last. A value saved in a "%stack.N" alloca around a jump or a label
// is a value that stays on the stack.

import {
  decodeBytes,
  integer,
  leadingComments,
  program,
  readError,
  relationsByJump,
  sourceLines,
} from './machine-reader-shared.js';

const llvmRelations = relationsByJump({
  equal: 'eq',
  notEqual: 'ne',
  less: 'slt',
  lessOrEqual: 'sle',
  greater: 'sgt',
  greaterOrEqual: 'sge',
});
const llvmArithmetic = {
  add: 'add',
  sub: 'subtract',
  mul: 'multiply',
  sdiv: 'divide',
  srem: 'remainder',
};
const temporary = /%t\.\d+/g;
const generatedBlock = /^(entry|next|dead)\.\d+$/;

// The bytes of a constant string, without the zero byte that ends it.
function llvmString(body) {
  const bytes = [];
  for (let index = 0; index < body.length; index += 1) {
    if (body[index] === '\\') {
      bytes.push(parseInt(body.slice(index + 1, index + 3), 16));
      index += 2;
    } else {
      bytes.push(body.charCodeAt(index));
    }
  }
  return decodeBytes(bytes.slice(0, -1));
}

function llvmTexts(lines) {
  const texts = new Map();
  for (const line of lines) {
    const match = line.match(/^@(text\.\d+) = [^"]* c"([^"]*)"$/);
    if (match) {
      texts.set(match[1], llvmString(match[2]));
    }
  }
  return texts;
}

// How often each temporary is used.
function useCounts(lines) {
  const uses = new Map();
  for (const line of lines) {
    for (const name of line.match(temporary) ?? []) {
      uses.set(name, (uses.get(name) ?? 0) + 1);
    }
    const defined = line.match(/^(%t\.\d+) = /)?.[1];
    if (defined) {
      uses.set(defined, uses.get(defined) - 1);
    }
  }
  return uses;
}

const argumentList = (text) => (text ? text.split(', ') : []);
const argumentValue = (text) => text.replace(/^\S+ /, '');

class LlvmBody {
  constructor(lines, texts, slots, parameters) {
    this.lines = lines;
    this.texts = texts;
    this.slots = slots;
    this.parameters = parameters;
    this.uses = useCounts(lines);
    this.defs = new Map();
    this.emitted = new Set();
    this.remaining = new Map();
    this.spills = [];
    this.code = [];
    this.index = 0;
  }

  operand(token) {
    if (/^-?\d+$/.test(token)) {
      return { kind: 'push', value: integer(token) };
    }
    if (this.defs.has(token)) {
      return { kind: 'temp', name: token };
    }
    throw readError('llvm', token, 'unknown value');
  }

  slot(address) {
    const name = address.match(/^%(.+)\.addr$/)?.[1];
    if (!this.slots.has(name)) {
      throw readError('llvm', address, 'unknown stack slot');
    }
    return this.slots.get(name);
  }

  // A temporary with a single use is written at that use; a temporary with
  // several uses is written at the first and stays on the stack.
  emitTemporary(name) {
    const node = this.defs.get(name);
    const total = this.uses.get(name) ?? 0;
    if (total <= 1) {
      this.emit(node);
      return;
    }
    if (!this.emitted.has(name)) {
      this.emit(node);
      this.emitted.add(name);
      this.remaining.set(name, total);
    }
    const left = this.remaining.get(name) - 1;
    this.remaining.set(name, left);
    if (left > 0) {
      this.code.push(['dup']);
    }
  }

  element(address) {
    const gep = this.defs.get(address);
    if (gep?.kind !== 'gep') {
      throw readError('llvm', address, 'not an element address');
    }
    this.emit(gep.array);
    this.emit(gep.index);
    this.code.push(['element-index']);
  }

  emit(node) {
    const write = {
      push: () => this.code.push(['push', node.value]),
      temp: () => this.emitTemporary(node.name),
      onstack: () => {},
      load: () => this.code.push(['load', node.slot]),
      binary: () => {
        this.emit(node.left);
        this.emit(node.right);
        this.code.push(['arithmetic', node.operation]);
      },
      negate: () => {
        this.emit(node.value);
        this.code.push(['negate']);
      },
      call: () => {
        node.args.forEach((argument) => this.emit(argument));
        this.code.push(['call', node.name, node.args.length]);
      },
      'new-array': () => {
        node.args.forEach((argument) => this.emit(argument));
        this.code.push(['new-array']);
      },
      'load-element': () => {
        this.element(node.address);
        this.code.push(['load-element']);
      },
      'array-length': () => {
        this.emit(node.array);
        this.code.push(['array-length']);
      },
    };
    write[node.kind]();
  }

  // A value that is never used is dropped where it is made.
  define(name, node) {
    this.defs.set(name, node);
    const structural = ['gep', 'length-address', 'compare'];
    if (!structural.includes(node.kind) && !this.uses.get(name)) {
      this.emit(node);
      this.code.push(['pop']);
    }
  }

  callNode(name, args) {
    const values = args.map((argument) =>
      this.operand(argumentValue(argument))
    );
    return name === 'new_array'
      ? { kind: 'new-array', args: values }
      : { kind: 'call', name, args: values };
  }

  load(name, address) {
    if (/^%stack\./.test(address)) {
      return this.define(name, { kind: 'onstack' });
    }
    const target = this.defs.get(address);
    if (target?.kind === 'gep') {
      return this.define(name, { kind: 'load-element', address });
    }
    if (target?.kind === 'length-address') {
      return this.define(name, { kind: 'array-length', array: target.array });
    }
    return this.define(name, { kind: 'load', slot: this.slot(address) });
  }

  store(value, address) {
    if (this.parameters.has(value)) {
      return;
    }
    const spill = address.match(/^%stack\.(?:ptr\.)?(\d+)$/);
    if (spill) {
      this.spills.push({ index: Number(spill[1]), node: this.operand(value) });
    } else if (this.defs.get(address)?.kind === 'gep') {
      this.element(address);
      this.emit(this.operand(value));
      this.code.push(['store-element']);
    } else {
      this.emit(this.operand(value));
      this.code.push(['store', this.slot(address)]);
    }
  }

  // The values saved around a jump go on the stack in the order of their
  // positions.
  flushSpills() {
    for (const { node } of this.spills.sort((a, b) => a.index - b.index)) {
      this.emit(node);
    }
    this.spills = [];
  }

  branch(target) {
    this.flushSpills();
    if (this.lines[this.index + 1] !== `${target}:`) {
      this.code.push(['jump', target]);
    }
  }

  conditionalBranch(condition, target) {
    this.flushSpills();
    const { relation, left, right } = this.defs.get(condition);
    this.emit(left);
    this.emit(right);
    this.code.push(['compare-jump', relation, target]);
  }

  print(text) {
    const parts = text.split(', ');
    if (parts[0] === 'ptr @integer_format') {
      this.emit(this.operand(argumentValue(parts[1])));
      this.code.push(['print-integer']);
    } else if (parts[0] === 'ptr @text_format') {
      this.code.push(['print-text', this.texts.get(parts[1].slice(5))]);
    } else {
      this.code.push(['print-newline']);
    }
  }

  rules() {
    const value = '(\\S+)';
    const named = (pattern) => new RegExp(`^(%t\\.\\d+) = ${pattern}$`);
    return [
      [/^; ?(.*)$/, ([, text]) => this.code.push(['comment', text])],
      [
        named(`load (?:i64|ptr), ptr ${value}`),
        ([, name, address]) => this.load(name, address),
      ],
      [
        named(`sub nsw i64 0, ${value}`),
        ([, name, operand]) =>
          this.define(name, {
            kind: 'negate',
            value: this.operand(operand),
          }),
      ],
      [
        named(`(add|sub|mul|sdiv|srem) i64 ${value}, ${value}`),
        ([, name, operation, left, right]) =>
          this.define(name, {
            kind: 'binary',
            operation: llvmArithmetic[operation],
            left: this.operand(left),
            right: this.operand(right),
          }),
      ],
      [
        named(`icmp (\\w+) i64 ${value}, ${value}`),
        ([, name, relation, left, right]) =>
          this.define(name, {
            kind: 'compare',
            relation: llvmRelations[relation],
            left: this.operand(left),
            right: this.operand(right),
          }),
      ],
      [
        named(`getelementptr i64, ptr ${value}, i64 ${value}`),
        ([, name, array, index]) =>
          this.define(name, {
            kind: 'gep',
            array: this.operand(array),
            index: this.operand(index),
          }),
      ],
      [
        named(`getelementptr i8, ptr ${value}, i64 -8`),
        ([, name, array]) =>
          this.define(name, {
            kind: 'length-address',
            array: this.operand(array),
          }),
      ],
      [
        named('call (?:i64|ptr) @(\\w+)\\((.*)\\)'),
        ([, name, callee, args]) =>
          this.define(name, this.callNode(callee, argumentList(args))),
      ],
      [
        new RegExp(`^store (?:i64|ptr) ${value}, ptr ${value}$`),
        ([, stored, address]) => this.store(stored, address),
      ],
      [
        /^call void @(\w+)\((.*)\)$/,
        ([, callee, args]) => {
          const node = this.callNode(callee, argumentList(args));
          this.emit(node);
        },
      ],
      [
        /^call i32 \(ptr, \.\.\.\) @printf\((.*)\)$/,
        ([, text]) => this.print(text),
      ],
      [/^br label %(\S+)$/, ([, target]) => this.branch(target)],
      [
        /^br i1 (\S+), label %(\S+), label %\S+$/,
        ([, condition, target]) => this.conditionalBranch(condition, target),
      ],
      [/^ret (?:void|i32 0)$/, () => this.code.push(['return-nothing'])],
      [
        /^ret i64 (\S+)$/,
        ([, returned]) => {
          this.emit(this.operand(returned));
          this.code.push(['return']);
        },
      ],
      [/^unreachable$/, () => {}],
      [
        /^([\w.]+):$/,
        ([, label]) => {
          if (!generatedBlock.test(label)) {
            this.code.push(['label', label]);
          }
        },
      ],
    ];
  }

  read() {
    const rules = this.rules();
    for (; this.index < this.lines.length; this.index += 1) {
      const line = this.lines[this.index];
      const rule = rules.find(([pattern]) => pattern.test(line));
      if (!rule) {
        throw readError('llvm', line, 'unknown instruction');
      }
      rule[1](line.match(rule[0]));
    }
    return this.code;
  }
}

function readLlvmFunction(header, comments, lines, texts) {
  const [, result, name, parameterList] = header;
  const parameters = argumentList(parameterList).map((item) =>
    item.replace(/^\S+ /, '')
  );
  const slots = new Map();
  const body = [];
  for (const line of lines) {
    const slot = line.match(/^%(.+)\.addr = alloca \w+$/);
    if (slot) {
      slots.set(slot[1], slots.size);
    } else if (!/^%\S+ = alloca \w+$/.test(line)) {
      body.push(line);
    }
  }
  const code = new LlvmBody(body, texts, slots, new Set(parameters)).read();
  return {
    name,
    parameterCount: parameters.length,
    slotNames: [...slots.keys()],
    returns: result === 'i64',
    comments,
    code,
  };
}

export function readLlvm(source) {
  const lines = sourceLines(source);
  const { comments, rest } = leadingComments(
    lines,
    ';',
    /^declare i32 @printf/
  );
  const texts = llvmTexts(rest);
  const items = [];
  let pending = [];
  for (let index = 0; index < rest.length; index += 1) {
    const line = rest[index];
    const header = line.match(/^define (i32|i64|void) @(\w+)\((.*)\) \{$/);
    if (line.startsWith(';')) {
      pending.push(line.replace(/^; ?/, ''));
    } else if (header) {
      const end = rest.indexOf('}', index);
      items.push(
        readLlvmFunction(header, pending, rest.slice(index + 1, end), texts)
      );
      pending = [];
      index = end;
    } else if (line) {
      pending = [];
    }
  }
  return program(comments, items);
}
