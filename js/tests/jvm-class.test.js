import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'test-anywhere';

import { createTranslator, readJvmClass } from '../src/index.js';

const fixture = readFileSync(
  new URL(
    '../../examples/programs/binary/StackArithmetic.class',
    import.meta.url
  )
);

function replaceBytes(original, replacement) {
  const offset = fixture.findIndex((_, index) =>
    original.every((byte, step) => fixture[index + step] === byte)
  );
  expect(offset).toBeGreaterThan(0);
  const modified = new Uint8Array(fixture);
  modified.set(replacement, offset);
  return modified;
}

describe('JVM class files', () => {
  it('checks instructions and lifts their arithmetic and output through the ordinary pipeline', () => {
    const { main } = readJvmClass(fixture);
    for (const [operation, value] of [
      ['push', -130],
      ['arithmetic', 'divide'],
      ['arithmetic', 'remainder'],
      ['print-text', 'Café 😀 '],
    ]) {
      expect(
        main.code.some(
          ([kind, argument]) => kind === operation && argument === value
        )
      ).toBe(true);
    }
    const translator = createTranslator();
    expect(translator.toMetaJvmClass(fixture).kind).toBe('Program');
    const javascript = translator.translateJvmClass(fixture, 'javascript');
    expect(javascript).toContain('Math.trunc(');
    expect(javascript).toContain('Café 😀 ');
  });

  it('rejects unsupported versions, invalid stack types, overflow and truncated bytes', () => {
    const invalidVersion = new Uint8Array(fixture);
    invalidVersion[7] = 66;
    const invalid = [
      [invalidVersion, /unsupported class file version 66.0/u],
      [fixture.subarray(0, -1), /truncated field/u],
      [
        replaceBytes([0x11, 0xff, 0x7e, 0x3c], [0xff]),
        /unsupported opcode 0xff/u,
      ],
      [
        replaceBytes([0x11, 0xff, 0x7e, 0x3c], [0x75]),
        /expected long on the instruction stack/u,
      ],
      [
        replaceBytes([3, 0, 0, 0x9c, 0x40], [3, 0x80, 0, 0, 1]),
        /exceeds the portable signed range/u,
      ],
      [
        replaceBytes([0xc3, 0xa9, 0x20, 0xed], [0xc0, 0x80]),
        /printed string contains an unsupported control character/u,
      ],
    ];
    for (const [source, message] of invalid) {
      expect(() => readJvmClass(source)).toThrow(message);
    }
  });
});
