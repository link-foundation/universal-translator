import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'test-anywhere';

import { createTranslator, readWasmBinary } from '../src/index.js';

const fixture = readFileSync(
  new URL('../../examples/programs/binary/wasm-stack.wasm', import.meta.url)
);

const header = [0, 0x61, 0x73, 0x6d, 1, 0, 0, 0];
const main = [
  1, 4, 1, 0x60, 0, 0, 3, 2, 1, 0, 7, 8, 1, 4, 109, 97, 105, 110, 0, 0,
];
const moduleWithBody = (body) =>
  Uint8Array.from([
    ...header,
    ...main,
    10,
    body.length + 2,
    1,
    body.length,
    ...body,
  ]);

describe('WebAssembly binary', () => {
  it('decodes executable instructions and uses the ordinary machine lifting stage', () => {
    const { functions, main: entry } = readWasmBinary(fixture);
    expect(functions.map(({ parameterCount }) => parameterCount)).toEqual([
      2, 0,
    ]);
    expect(
      entry.code.some(
        ([operation, value]) => operation === 'push' && value === -130
      )
    ).toBe(true);
    expect(
      entry.code.some(
        ([operation, value]) => operation === 'arithmetic' && value === 'divide'
      )
    ).toBe(true);
    const translator = createTranslator();
    expect(translator.toMetaWasm(fixture).kind).toBe('Program');
    const javascript = translator.translateWasm(fixture, 'javascript');
    expect(
      javascript.indexOf('const wasmValue7 = wasmInternal0(')
    ).toBeLessThan(javascript.indexOf('wasmInternal1();'));
    expect(javascript).toContain('Math.trunc(-1 / 2) + 0');
  });

  it('validates binary framing, stack effects, and the supported subset', () => {
    const headerOnly = Uint8Array.from(header);
    const empty = moduleWithBody([0, 0x0b]);
    const invalid = [
      [Uint8Array.from([...header.slice(0, 4), 2, 0, 0, 0]), /version 1/],
      [fixture.subarray(0, fixture.length - 1), /truncated length/],
      [headerOnly, /must export main/],
      [Uint8Array.from([...header, 0, 2, 1, 0xff]), /invalid UTF-8 name/],
      [Uint8Array.from([...empty, 1, 1, 0]), /out-of-order section/],
      [
        Uint8Array.from([...header, 1, 0x80, 0x80, 0x80, 0x80, 0x10]),
        /unsigned LEB128/,
      ],
      [
        moduleWithBody([0, 0x42, ...Array(10).fill(0x80), 0x0b]),
        /signed LEB128/,
      ],
      [moduleWithBody([0, 0x1a, 0x0b]), /stack underflow/],
      [moduleWithBody([0, 0x42, 0, 0x0b]), /unexpected values/],
      [moduleWithBody([0, 0x20, 0, 0x1a, 0x0b]), /unknown local index/],
      [moduleWithBody([0, 0x10, 0, 0x0b]), /unsupported call target/],
      [moduleWithBody([0, 0x10, 10, 0x0b]), /unsupported call target/],
      [moduleWithBody([1, 0x81, 2, 0x7e, 0x0b]), /too many local slots/],
      [moduleWithBody([1, 1, 0x7f, 0x0b]), /only i64 locals/],
      [moduleWithBody([1, 0, 0x7e, 0x0b, 0]), /unexpected bytes/],
      [moduleWithBody([0, 0x0f, 0x01, 0x0b]), /instructions after return/],
      [moduleWithBody([0, 0x41, 0, 0x0b]), /unsupported opcode 0x41/],
    ];
    for (const [input, message] of invalid) {
      expect(() => readWasmBinary(input)).toThrow(message);
    }
  });

  it('reads an allowed padded negative LEB128 and a terminal explicit return', () => {
    const input = moduleWithBody([0, 0x42, 0xff, 0x7f, 0x1a, 0x0f, 0x0b]);
    expect(readWasmBinary(input).main.code).toEqual([
      ['push', -1],
      ['pop'],
      ['return-nothing'],
    ]);
  });
});
