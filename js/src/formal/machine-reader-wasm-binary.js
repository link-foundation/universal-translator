// The version-1 binary encoding described by the WebAssembly core spec.
import { integer, program } from './machine-reader-shared.js';

const maxItems = 256;
const maxInstructions = 512;
const maxBytes = 4 * 1024 * 1024;
const decoder = new globalThis.TextDecoder('utf-8', {
  fatal: true,
  ignoreBOM: true,
});
const arithmetic = new Map([
  [0x7c, 'add'],
  [0x7d, 'subtract'],
  [0x7e, 'multiply'],
  [0x7f, 'divide'],
  [0x81, 'remainder'],
]);
const printImports = new Map([
  ['print_integer', ['print-integer', 1]],
  ['print_newline', ['print-newline', 0]],
]);

class BinaryReader {
  constructor(source, start = 0, end = source.length) {
    this.source = source;
    this.offset = start;
    this.end = end;
  }

  error(message) {
    return new Error(
      `Cannot read WebAssembly at byte ${this.offset}: ${message}`
    );
  }

  byte() {
    if (this.offset >= this.end) {
      throw this.error('unexpected end of input');
    }
    return this.source[this.offset++];
  }

  leb(bits, signed = false) {
    let value = 0n;
    for (let shift = 0; shift < bits; shift += 7) {
      const byte = this.byte();
      value |= BigInt(byte & 0x7f) << BigInt(shift);
      if ((byte & 0x80) === 0) {
        if (signed && byte & 0x40) {
          value -= 1n << BigInt(shift + 7);
        }
        const bounded = signed
          ? BigInt.asIntN(bits, value)
          : BigInt.asUintN(bits, value);
        if (value !== bounded) {
          break;
        }
        return value;
      }
    }
    throw this.error(
      `invalid ${signed ? 'signed' : 'unsigned'} LEB128 integer`
    );
  }

  uint() {
    return Number(this.leb(32));
  }

  expect(value, message) {
    if (this.byte() !== value) {
      throw this.error(message);
    }
  }

  vector(read) {
    const count = this.uint();
    if (count > maxItems || count > this.end - this.offset) {
      throw this.error('invalid or unsupported vector length');
    }
    return Array.from({ length: count }, read);
  }

  slice() {
    const length = this.uint();
    const end = this.offset + length;
    if (end > this.end) {
      throw this.error('truncated length-delimited field');
    }
    const reader = new BinaryReader(this.source, this.offset, end);
    this.offset = end;
    return reader;
  }

  name() {
    const field = this.slice();
    try {
      return decoder.decode(this.source.subarray(field.offset, field.end));
    } catch {
      throw field.error('invalid UTF-8 name');
    }
  }

  finish() {
    if (this.offset !== this.end) {
      throw this.error('unexpected bytes after the declared contents');
    }
  }
}

function sections(reader) {
  const result = new Map();
  let previous = 0;
  while (reader.offset < reader.end) {
    const id = reader.byte();
    const content = reader.slice();
    if (id === 0) {
      content.name();
      continue;
    }
    if (id <= previous || ![1, 2, 3, 7, 10].includes(id)) {
      throw content.error(`unsupported or out-of-order section ${id}`);
    }
    result.set(id, content);
    previous = id;
  }
  return result;
}

function readVector(reader, read) {
  if (!reader) {
    return [];
  }
  const values = reader.vector(() => read(reader));
  reader.finish();
  return values;
}

function readType(reader) {
  reader.expect(0x60, 'expected a function type');
  const i64 = () => reader.expect(0x7e, 'only i64 value types are supported');
  const params = reader.vector(i64).length;
  const results = reader.vector(i64).length;
  if (results > 1) {
    throw reader.error('multiple function results are unsupported');
  }
  return { params, results };
}

function signature(reader, types) {
  const type = types[reader.uint()];
  if (!type) {
    throw reader.error('unknown function type');
  }
  return type;
}

function readImport(reader, types) {
  const module = reader.name();
  const field = reader.name();
  reader.expect(0, 'only function imports are supported');
  const type = signature(reader, types);
  const host = printImports.get(field);
  if (module !== 'env' || !host || type.params !== host[1] || type.results) {
    throw reader.error(`unsupported function import ${module}.${field}`);
  }
  return { ...type, operation: host[0] };
}

function freshName(base, used) {
  let name = base;
  while (used.has(name)) {
    name += '_private';
  }
  used.add(name);
  return name;
}

function exportNames(reader, imports, functions) {
  const names = new Map();
  const seen = new Set();
  readVector(reader, (entry) => {
    const name = entry.name();
    entry.expect(0, 'only function exports are supported');
    const index = entry.uint() - imports.length;
    if (
      index < 0 ||
      index >= functions.length ||
      !/^[a-z][a-z0-9]*(?:_[a-z][a-z0-9]*)*$/u.test(name) ||
      names.has(index) ||
      seen.has(name)
    ) {
      throw entry.error(`unsupported or duplicate export ${name}`);
    }
    names.set(index, name);
    seen.add(name);
  });
  if (!seen.has('main')) {
    throw new Error('WebAssembly module must export main');
  }
  return functions.map((type, index) => ({
    ...type,
    name: names.get(index) ?? freshName(`wasm_internal${index}`, seen),
  }));
}

function readOperation(reader, opcode, slotCount, callable) {
  if (opcode === 0x42) {
    return [['push', integer(reader.leb(64, true))], 0, 1];
  }
  if (opcode === 0x20 || opcode === 0x21) {
    const index = reader.uint();
    if (index >= slotCount) {
      throw reader.error('unknown local index');
    }
    return opcode === 0x20 ? [['load', index], 0, 1] : [['store', index], 1, 0];
  }
  if (opcode === 0x10) {
    const target = callable[reader.uint()];
    if (!target || target.name === 'main') {
      throw reader.error('unsupported call target');
    }
    const instruction = target.operation
      ? [target.operation]
      : ['call', target.name, target.params];
    return [instruction, target.params, target.results];
  }
  if (opcode === 0x1a) {
    return [['pop'], 1, 0];
  }
  if (arithmetic.has(opcode)) {
    return [['arithmetic', arithmetic.get(opcode)], 2, 1];
  }
  throw reader.error(`unsupported opcode 0x${opcode.toString(16)}`);
}

function readBody(reader, type, callable, functionNames) {
  const { params, name, results } = type;
  if (name === 'main' && (params !== 0 || results !== 0)) {
    throw reader.error('main must have no parameters or results');
  }
  const locals = reader.vector(() => {
    const count = reader.uint();
    reader.expect(0x7e, 'only i64 locals are supported');
    if (count > maxItems) {
      throw reader.error('too many local slots');
    }
    return count;
  });
  const slotCount = params + locals.reduce((sum, count) => sum + count, 0);
  if (slotCount > maxItems) {
    throw reader.error('too many local slots');
  }
  const used = new Set(functionNames);
  const slotNames = Array.from({ length: slotCount }, (_, i) =>
    freshName(`wasm_local${i}`, used)
  );
  const code = [];
  // WebAssembly initializes declared locals to zero before entering the body.
  for (let index = params; index < slotCount; index += 1) {
    code.push(['push', 0], ['store', index]);
  }
  let depth = 0;
  for (let step = 0; step < maxInstructions; step += 1) {
    const opcode = reader.byte();
    if (opcode === 0x0f || opcode === 0x0b) {
      if (opcode === 0x0f) {
        reader.expect(0x0b, 'unsupported instructions after return');
      }
      reader.finish();
      if (depth !== results) {
        throw reader.error('unexpected values on the function stack');
      }
      code.push([results ? 'return' : 'return-nothing']);
      return {
        name,
        parameterCount: params,
        slotNames,
        returns: !!results,
        comments: [],
        code,
      };
    }
    const [instruction, consumed, produced] = readOperation(
      reader,
      opcode,
      slotCount,
      callable
    );
    if (depth < consumed) {
      throw reader.error('instruction stack underflow');
    }
    depth += produced - consumed;
    code.push(instruction);
    // Lifting builds expressions lazily. Materialize values that can change,
    // call another function or trap at the point WebAssembly evaluates them.
    if (produced && opcode !== 0x42) {
      const slot = slotNames.length;
      slotNames.push(freshName(`wasm_value${step}`, used));
      code.push(['store', slot], ['load', slot]);
    }
  }
  throw reader.error('too many instructions in a straight-line function');
}

export function readWasmBinary(source) {
  const reader = new BinaryReader(source);
  if (source.length > maxBytes) {
    throw reader.error('module exceeds the supported size');
  }
  for (const byte of [0, 0x61, 0x73, 0x6d, 1, 0, 0, 0]) {
    reader.expect(byte, 'expected WebAssembly binary version 1');
  }
  const parts = sections(reader);
  const types = readVector(parts.get(1), readType);
  const imports = readVector(parts.get(2), (item) => readImport(item, types));
  const functions = readVector(parts.get(3), (item) => signature(item, types));
  const named = exportNames(parts.get(7), imports, functions);
  const callable = [...imports, ...named];
  const bodies = readVector(parts.get(10), (item) => item.slice());
  if (named.length !== bodies.length) {
    throw reader.error('function and code counts differ');
  }
  const functionNames = named.map(({ name }) => name);
  return program(
    [],
    bodies.map((body, index) =>
      readBody(body, named[index], callable, functionNames)
    )
  );
}
