// Java class files, JVMS §4, with a straight-line subset of §6 instructions.
import { program } from './machine-reader-shared.js';

const maxBytes = 4 * 1024 * 1024;
const maxConstants = 4096;
const maxInstructions = 512;
const printStream = 'Ljava/io/PrintStream;';
const printTypes = new Map([
  ['(I)V', 'int'],
  ['(J)V', 'long'],
  ['(Ljava/lang/String;)V', 'text'],
]);
const padding = Symbol('second long local slot');
const stdout = { type: 'stdout', width: 1 };
const supportedAttributes = {
  class: new Set(['SourceFile']),
  code: new Set(['LineNumberTable', 'LocalVariableTable']),
};

class Reader {
  constructor(source, offset = 0, end = source.length) {
    this.source = source;
    this.offset = offset;
    this.end = end;
    this.view = new DataView(
      source.buffer,
      source.byteOffset,
      source.byteLength
    );
  }

  error(message) {
    return new Error(
      `Cannot read JVM class at byte ${this.offset}: ${message}`
    );
  }

  take(length) {
    const offset = this.offset;
    if (length > this.end - offset) {
      throw this.error('truncated field');
    }
    this.offset += length;
    return offset;
  }

  u1() {
    return this.view.getUint8(this.take(1));
  }

  u2() {
    return this.view.getUint16(this.take(2));
  }

  u4() {
    return this.view.getUint32(this.take(4));
  }

  field(length) {
    const start = this.take(length);
    return new Reader(this.source, start, start + length);
  }

  expect(actual, expected, message) {
    if (actual !== expected) {
      throw this.error(message);
    }
  }

  finish() {
    this.expect(
      this.offset,
      this.end,
      'unexpected bytes after the declared contents'
    );
  }
}

function modifiedUtf8(reader) {
  const bytes = reader.field(reader.u2());
  const decoded = [];
  while (bytes.offset < bytes.end) {
    const first = bytes.u1();
    if (first >= 1 && first <= 0x7f) {
      decoded.push(String.fromCharCode(first));
      continue;
    }
    const second = bytes.u1();
    if ((second & 0xc0) !== 0x80) {
      throw bytes.error('invalid modified UTF-8');
    }
    if ((first & 0xe0) === 0xc0) {
      const code = ((first & 0x1f) << 6) | (second & 0x3f);
      if (code === 0 || code >= 0x80) {
        decoded.push(String.fromCharCode(code));
        continue;
      }
    } else if ((first & 0xf0) === 0xe0) {
      const third = bytes.u1();
      const code =
        ((first & 0x0f) << 12) | ((second & 0x3f) << 6) | (third & 0x3f);
      if ((third & 0xc0) === 0x80 && code >= 0x800) {
        decoded.push(String.fromCharCode(code));
        continue;
      }
    }
    throw bytes.error('invalid modified UTF-8');
  }
  const text = decoded.join('');
  if (/[\uD800-\uDFFF]/u.test(text)) {
    throw bytes.error('unpaired UTF-16 surrogate');
  }
  return text;
}

function readPool(reader) {
  const count = reader.u2();
  if (!count || count > maxConstants) {
    throw reader.error('unsupported constant pool length');
  }
  const pool = Array(count);
  for (let index = 1; index < count; index += 1) {
    const tag = reader.u1();
    switch (tag) {
      case 1:
        pool[index] = [tag, modifiedUtf8(reader)];
        break;
      case 3:
        pool[index] = [tag, BigInt.asIntN(32, BigInt(reader.u4()))];
        break;
      case 5: {
        const bits = (BigInt(reader.u4()) << 32n) | BigInt(reader.u4());
        pool[index] = [tag, BigInt.asIntN(64, bits)];
        index += 1;
        if (index >= count) {
          throw reader.error('missing second constant pool entry for long');
        }
        break;
      }
      case 7:
      case 8:
        pool[index] = [tag, reader.u2()];
        break;
      case 9:
      case 10:
      case 12:
        pool[index] = [tag, reader.u2(), reader.u2()];
        break;
      default:
        throw reader.error(`unsupported constant pool tag ${tag}`);
    }
  }
  return pool;
}

const constant = (reader, pool, index, ...tags) => {
  const entry = pool[index];
  if (!entry || !tags.includes(entry[0])) {
    throw reader.error(`invalid constant pool reference ${index}`);
  }
  return entry;
};
const text = (reader, pool, index) => constant(reader, pool, index, 1)[1];
const className = (reader, pool, index) =>
  text(reader, pool, constant(reader, pool, index, 7)[1]);

function member(reader, pool, tag) {
  const [, owner, nameAndType] = constant(reader, pool, reader.u2(), tag);
  const [, name, descriptor] = constant(reader, pool, nameAndType, 12);
  return [
    className(reader, pool, owner),
    text(reader, pool, name),
    text(reader, pool, descriptor),
  ];
}

function attributes(reader, pool, read) {
  const count = reader.u2();
  if (count > 16) {
    throw reader.error('too many attributes');
  }
  const seen = new Set();
  for (let index = 0; index < count; index += 1) {
    const name = text(reader, pool, reader.u2());
    const body = reader.field(reader.u4());
    if (seen.has(name)) {
      throw body.error(`duplicate attribute ${name}`);
    }
    seen.add(name);
    read(body, name);
    body.finish();
  }
}

function debugAttribute(body, name, pool, location) {
  if (!supportedAttributes[location].has(name)) {
    throw body.error(`unsupported ${location} attribute ${name}`);
  }
  if (name === 'SourceFile') {
    text(body, pool, body.u2());
    return;
  }
  const count = body.u2();
  const entrySize = name === 'LineNumberTable' ? 4 : 10;
  body.take(count * entrySize);
}

const binaryOperations = new Map([
  [0x60, ['add', (a, b) => a + b]],
  [0x64, ['subtract', (a, b) => a - b]],
  [0x68, ['multiply', (a, b) => a * b]],
  [0x6c, ['divide', (a, b) => a / b]],
  [0x70, ['remainder', (a, b) => a % b]],
]);

const localOpcodes = [
  [0x15, 0x1a, 'int', false],
  [0x16, 0x1e, 'long', false],
  [0x36, 0x3b, 'int', true],
  [0x37, 0x3f, 'long', true],
];

function localOperation(reader, opcode) {
  for (const [generic, compact, kind, write] of localOpcodes) {
    if (opcode === generic) {
      return [reader.u1(), kind, write];
    }
    if (opcode >= compact && opcode < compact + 4) {
      return [opcode - compact, kind, write];
    }
  }
  return undefined;
}

class MainBody {
  constructor(reader, pool, stackLimit, slotCount) {
    this.reader = reader;
    this.pool = pool;
    this.stackLimit = stackLimit;
    this.stack = [];
    this.depth = 0;
    this.locals = Array(slotCount);
    this.locals[0] = { type: 'arguments' };
    this.slotNames = Array.from(this.locals, (_, i) => `jvm_local${i}`);
    this.code = [];
  }

  push(value) {
    this.depth += value.width;
    if (this.depth > this.stackLimit) {
      throw this.reader.error('instruction stack exceeds max_stack');
    }
    this.stack.push(value);
  }

  pop(type) {
    const value = this.stack.pop();
    if (value?.type !== type) {
      throw this.reader.error(`expected ${type} on the instruction stack`);
    }
    this.depth -= value.width;
    return value;
  }

  pushInteger(type, value, instruction, materialize = false) {
    if (value < -2147483647n || value > 2147483647n) {
      throw this.reader.error(
        'integer result exceeds the portable signed range'
      );
    }
    this.push({ type, width: type === 'long' ? 2 : 1, value });
    this.code.push(instruction);
    if (materialize) {
      const slot = this.slotNames.length;
      this.slotNames.push(`jvm_value${slot}`);
      this.code.push(['store', slot], ['load', slot]);
    }
  }

  local([slot, type, write]) {
    const previous = this.locals[slot];
    if (
      slot === 0 ||
      slot + (type === 'long' ? 1 : 0) >= this.locals.length ||
      (previous && previous.type !== type) ||
      (type === 'long' && ![undefined, padding].includes(this.locals[slot + 1]))
    ) {
      throw this.reader.error('invalid or retyped local slot');
    }
    if (write) {
      this.locals[slot] = this.pop(type);
      if (type === 'long') {
        this.locals[slot + 1] = padding;
      }
      this.code.push(['store', slot]);
    } else {
      if (!previous) {
        throw this.reader.error('load before local initialization');
      }
      this.pushInteger(type, previous.value, ['load', slot], true);
    }
  }

  literal(opcode) {
    const { reader, pool } = this;
    if (opcode === 0x12 || opcode === 0x13) {
      const index = opcode === 0x12 ? reader.u1() : reader.u2();
      const [tag, value] = constant(reader, pool, index, 3, 8);
      if (tag === 8) {
        this.push({ type: 'text', width: 1, value: text(reader, pool, value) });
      } else {
        this.pushInteger('int', value, ['push', Number(value)]);
      }
      return;
    }
    let type = 'int';
    let value;
    if (opcode === 0x14 || opcode === 0x09 || opcode === 0x0a) {
      type = 'long';
      value =
        opcode === 0x14
          ? constant(reader, pool, reader.u2(), 5)[1]
          : BigInt(opcode - 0x09);
    } else if (opcode === 0x10) {
      value = BigInt.asIntN(8, BigInt(reader.u1()));
    } else if (opcode === 0x11) {
      value = BigInt.asIntN(16, BigInt(reader.u2()));
    } else {
      value = BigInt(opcode - 0x03);
    }
    this.pushInteger(type, value, ['push', Number(value)]);
  }

  arithmetic(opcode) {
    const type = opcode % 2 ? 'long' : 'int';
    const right = this.pop(type).value;
    if (opcode === 0x74 || opcode === 0x75) {
      this.pushInteger(type, -right, ['negate'], true);
      return;
    }
    const left = this.pop(type).value;
    const [name, calculate] = binaryOperations.get(opcode & ~1);
    if (right === 0n && (name === 'divide' || name === 'remainder')) {
      throw this.reader.error(
        'division by zero is outside the supported subset'
      );
    }
    this.pushInteger(type, calculate(left, right), ['arithmetic', name], true);
  }

  output() {
    const [owner, name, descriptor] = member(this.reader, this.pool, 10);
    const type = printTypes.get(descriptor);
    if (
      owner !== 'java/io/PrintStream' ||
      (name !== 'print' && name !== 'println') ||
      (!type && (descriptor !== '()V' || name !== 'println'))
    ) {
      throw this.reader.error(
        `unsupported virtual method ${owner}.${name}${descriptor}`
      );
    }
    const value = type ? this.pop(type) : undefined;
    this.pop('stdout');
    if (type === 'text') {
      if (
        [...value.value].some(
          (character) => character < ' ' && !'\t\n\r'.includes(character)
        )
      ) {
        throw this.reader.error(
          'printed string contains an unsupported control character'
        );
      }
      this.code.push(['print-text', value.value]);
    } else if (type) {
      this.code.push(['print-integer']);
    }
    if (name === 'println') {
      this.code.push(['print-newline']);
    }
  }

  loadStdout() {
    const [owner, name, descriptor] = member(this.reader, this.pool, 9);
    if (
      owner !== 'java/lang/System' ||
      name !== 'out' ||
      descriptor !== printStream
    ) {
      throw this.reader.error(`unsupported static field ${owner}.${name}`);
    }
    this.push(stdout);
  }

  finish() {
    this.reader.finish();
    if (this.stack.length) {
      throw this.reader.error(
        'unexpected values on the instruction stack at return'
      );
    }
    this.code.push(['return-nothing']);
    return {
      name: 'main',
      parameterCount: 0,
      slotNames: this.slotNames,
      returns: false,
      comments: [],
      code: this.code,
    };
  }

  read() {
    const { reader } = this;
    for (let step = 0; step < maxInstructions; step += 1) {
      const opcode = reader.u1();
      const local = localOperation(reader, opcode);
      if (local) {
        this.local(local);
      } else if (
        (opcode >= 0x02 && opcode <= 0x0a) ||
        (opcode >= 0x10 && opcode <= 0x14)
      ) {
        this.literal(opcode);
      } else if (
        binaryOperations.has(opcode & ~1) ||
        opcode === 0x74 ||
        opcode === 0x75
      ) {
        this.arithmetic(opcode);
      } else if (opcode === 0x85) {
        const { value } = this.pop('int');
        this.push({ type: 'long', width: 2, value });
      } else if (opcode === 0xb2) {
        this.loadStdout();
      } else if (opcode === 0xb6) {
        this.output();
      } else if (opcode === 0xb1) {
        return this.finish();
      } else {
        throw reader.error(`unsupported opcode 0x${opcode.toString(16)}`);
      }
    }
    throw reader.error('too many instructions in a straight-line method');
  }
}

function defaultConstructor(reader, pool, stackLimit, slotCount) {
  if (
    stackLimit < 1 ||
    slotCount < 1 ||
    reader.u1() !== 0x2a ||
    reader.u1() !== 0xb7
  ) {
    throw reader.error('unsupported constructor');
  }
  const [owner, name, descriptor] = member(reader, pool, 10);
  if (
    owner !== 'java/lang/Object' ||
    name !== '<init>' ||
    descriptor !== '()V' ||
    reader.u1() !== 0xb1
  ) {
    throw reader.error('unsupported constructor');
  }
  reader.finish();
}

function readMethods(reader, pool) {
  const count = reader.u2();
  if (count < 1 || count > 2) {
    throw reader.error('expected main and an optional default constructor');
  }
  const names = new Set();
  const methods = [];
  for (let index = 0; index < count; index += 1) {
    const flags = reader.u2();
    const name = text(reader, pool, reader.u2());
    const descriptor = text(reader, pool, reader.u2());
    const main =
      name === 'main' && flags === 9 && descriptor === '([Ljava/lang/String;)V';
    const constructor =
      name === '<init>' && [0, 1, 2, 4].includes(flags) && descriptor === '()V';
    if ((!main && !constructor) || names.has(name)) {
      throw reader.error(
        `unsupported or duplicate method ${name}${descriptor}`
      );
    }
    names.add(name);
    reader.expect(reader.u2(), 1, 'expected exactly one method attribute');
    reader.expect(
      text(reader, pool, reader.u2()),
      'Code',
      'expected a Code attribute'
    );
    const body = reader.field(reader.u4());
    const stackLimit = body.u2();
    const slotCount = body.u2();
    if (slotCount < 1 || slotCount > 256 || stackLimit > 256) {
      throw body.error('unsupported max_stack or max_locals');
    }
    const code = body.field(body.u4());
    if (main) {
      methods.push(new MainBody(code, pool, stackLimit, slotCount).read());
    } else {
      defaultConstructor(code, pool, stackLimit, slotCount);
    }
    body.expect(body.u2(), 0, 'exception handlers are unsupported');
    attributes(body, pool, (field, attribute) =>
      debugAttribute(field, attribute, pool, 'code')
    );
    body.finish();
  }
  return methods;
}

export function readJvmClass(source) {
  const reader = new Reader(source);
  if (source.length > maxBytes) {
    throw reader.error('class exceeds the supported size');
  }
  reader.expect(reader.u4(), 0xcafebabe, 'expected JVM class file magic');
  const minor = reader.u2();
  const major = reader.u2();
  if (minor !== 0 || major < 52 || major > 65) {
    throw reader.error(`unsupported class file version ${major}.${minor}`);
  }
  const pool = readPool(reader);
  if (![0x20, 0x21, 0x30, 0x31].includes(reader.u2())) {
    throw reader.error('unsupported class flags');
  }
  className(reader, pool, reader.u2());
  reader.expect(
    className(reader, pool, reader.u2()),
    'java/lang/Object',
    'unsupported superclass'
  );
  reader.expect(reader.u2(), 0, 'interfaces are unsupported');
  reader.expect(reader.u2(), 0, 'fields are unsupported');
  const methods = readMethods(reader, pool);
  attributes(reader, pool, (body, name) =>
    debugAttribute(body, name, pool, 'class')
  );
  reader.finish();
  return program([], methods);
}
