import { describe, expect, it } from 'test-anywhere';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createGrammarTranslator } from '../src/grammar/translator.js';
import { machineTargetIds } from '../src/grammar/machine.js';
import { readCil, readJvm, readNasm } from '../src/grammar/machine-reader.js';

const translator = createGrammarTranslator();
const folder = join(import.meta.dirname, '../../examples/programs');
const tasks = [
  'factorial',
  'fizz-buzz',
  'greatest-common-divisor',
  'hello-world',
  'sum-of-squares',
];
const extensions = { nasm: '.asm', cil: '.il', jvm: '.j' };
const golden = (task, extension) =>
  readFileSync(join(folder, 'translated', task, `${task}${extension}`), 'utf8');

// Run JavaScript source and return what it prints.
const run = (source) => {
  const result = spawnSync(process.execPath, ['--input-type=module'], {
    input: source,
    encoding: 'utf8',
    timeout: 10000,
  });
  expect(result.stderr).toBe('');
  return result.stdout;
};

// Programs that use every condition and statement form lowering writes.
const conditions = `function sign(value) {
  if (value < 0) {
    return -1;
  } else if (value === 0) {
    return 0;
  }
  return 1;
}

function report(value) {
  console.log(\`value \${value}\`);
}

let count = 0;
let index = -3;
while (index < 4 && !(index === 2 || count > 5)) {
  const small = index < 1 || index > 2;
  if ((index > -3 || count === 0) && small) {
    count += sign(index) + 2;
  }
  if (!(index > 0 && count !== 1)) {
    report(index * count);
  }
  index += 1;
}
for (let step = 0; step < 3; step++) {
  console.log(step);
}
console.log(\`count \${count}, \${count / 2}, \${count % 3}\`);
`;

describe('reading machine code', () => {
  it('reads procedures, slots, comments and text', () => {
    const nasm = readNasm(golden('greatest-common-divisor', '.asm'));
    expect(nasm.comments.length).toBe(1);
    expect(nasm.functions[0].name).toBe('greatest_common_divisor');
    expect(nasm.functions[0].slotNames).toEqual([
      'first',
      'second',
      'remainder',
    ]);
    expect(nasm.functions[0].parameterCount).toBe(2);
    expect(
      nasm.main.code.some(
        ([operation, value]) =>
          operation === 'print-text' &&
          value === 'The greatest common divisor of 1071 and 462 is '
      )
    ).toBe(true);
    const cil = readCil(golden('greatest-common-divisor', '.il'));
    expect(cil.functions[0].name).toBe('GreatestCommonDivisor');
    expect(cil.functions[0].code).toEqual(nasm.functions[0].code);
    const jvm = readJvm(golden('greatest-common-divisor', '.j'));
    expect(jvm.main.code.map(([operation]) => operation)).toEqual(
      cil.main.code.map(([operation]) => operation)
    );
  });

  it('decodes text that is not plain ASCII', () => {
    const source = 'console.log("Привет, мир! ✓ \\"quoted\\"");\n';
    for (const target of machineTargetIds) {
      const machine = translator.translate(source, 'javascript', target);
      expect(run(translator.translate(machine, target, 'javascript'))).toBe(
        'Привет, мир! ✓ "quoted"\n'
      );
    }
  });

  it('reports code it does not recognize', () => {
    expect(() => translator.translate('ret', 'nasm', 'c')).toThrow(
      'no entry point'
    );
    const broken = golden('factorial', '.j').replace('lmul', 'dmul');
    expect(() => translator.translate(broken, 'jvm', 'c')).toThrow(
      'Cannot read jvm line "dmul"'
    );
  });
});

describe('lifting machine code into the meta language', () => {
  for (const task of tasks) {
    it(`translates ${task} between assembly, CIL and JVM bytecode`, () => {
      const original = readFileSync(join(folder, `${task}.js`), 'utf8');
      const expected = run(original);
      for (const from of machineTargetIds) {
        const source = golden(task, extensions[from]);
        for (const to of machineTargetIds) {
          expect(translator.translate(source, from, to)).toBe(
            golden(task, extensions[to])
          );
        }
        expect(run(translator.translate(source, from, 'javascript'))).toBe(
          expected
        );
      }
    });
  }

  it('rebuilds nested conditions, loops and boolean values', () => {
    // Machine code divides integers, as the JavaScript translation does.
    const expected = run(
      translator.translate(conditions, 'javascript', 'javascript')
    );
    for (const target of machineTargetIds) {
      const machine = translator.translate(conditions, 'javascript', target);
      const lifted = translator.translate(machine, target, 'javascript');
      expect(run(lifted)).toBe(expected);
      expect(translator.translate(lifted, 'javascript', target)).toBe(machine);
      expect(lifted).toContain('for (let step = 0; step < 3; step++)');
      expect(lifted).toContain('const small = index < 1 || index > 2;');
    }
  });

  it('gives the lifted program readable names and types', () => {
    const meta = translator.toMeta(golden('factorial', '.il'), 'cil');
    const [factorial] = meta.functions;
    expect(factorial.name).toBe('factorial');
    expect(factorial.parameters).toEqual([{ name: 'number', type: 'integer' }]);
    expect(factorial.returnType).toBe('integer');
    const python = translator.translate(
      golden('greatest-common-divisor', '.j'),
      'jvm',
      'python'
    );
    expect(python).toContain('def greatest_common_divisor(first, second):');
    expect(python).toContain('# Greatest common divisor in Python');
  });
});
