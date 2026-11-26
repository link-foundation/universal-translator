import { describe, expect, it } from 'test-anywhere';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';

import { createGrammarTranslator } from '../src/translator.js';
import { machineTargetIds, machineTargets } from '../src/formal/machine.js';
import { readArm64, readGas } from '../src/formal/machine-reader-assembly.js';
import { readLlvm } from '../src/formal/machine-reader-llvm.js';
import { readWat } from '../src/formal/machine-reader-wasm.js';

const translator = createGrammarTranslator();
const programs = join(import.meta.dirname, '../../examples/programs');
const extensions = {
  nasm: '.asm',
  gas: '.s',
  arm64: '.arm64',
  cil: '.il',
  jvm: '.j',
  llvm: '.ll',
  wat: '.wat',
};
const dialects = ['gas', 'arm64', 'llvm', 'wat'];
const tasks = readdirSync(join(programs, 'translated')).sort();
const source = (task) => readFileSync(join(programs, `${task}.js`), 'utf8');
const golden = (task, target) =>
  readFileSync(
    join(programs, 'translated', task, `${task}${extensions[target]}`),
    'utf8'
  );
// A program without its comments, which name the language they are written in.
const withoutComments = (text) =>
  text
    .split('\n')
    .filter((line) => !/^\s*(?:\/\/|;;?|#)/.test(line))
    .join('\n');

describe('the machine targets in the language listing', () => {
  it('lists every dialect after the grammar languages, flagged as machine', () => {
    const listing = translator.languages();
    const machine = listing.filter((language) => language.machine);
    expect(machine.map(({ id }) => id)).toEqual(machineTargetIds);
    expect(listing.slice(-machine.length)).toEqual(machine);
    expect(machineTargetIds).toEqual([
      'nasm',
      'gas',
      'arm64',
      'cil',
      'jvm',
      'llvm',
      'wat',
    ]);
    expect(listing.filter((language) => !language.machine).length).toBe(33);
    for (const language of listing.filter(({ machine: flag }) => !flag)) {
      expect(language.machine).toBe(undefined);
    }
  });

  it('labels the dialects', () => {
    const labels = Object.fromEntries(
      translator.languages().map(({ id, label }) => [id, label])
    );
    expect(labels.nasm).toBe('x86-64 assembly (NASM)');
    expect(labels.gas).toBe('x86-64 assembly (GNU as, AT&T)');
    expect(labels.arm64).toBe('ARM64 assembly');
    expect(labels.llvm).toBe('LLVM IR');
    expect(labels.wat).toBe('WebAssembly text');
    for (const id of machineTargetIds) {
      expect(machineTargets[id].label).toBe(labels[id]);
    }
  });
});

describe('writing the Rosetta programs as machine code', () => {
  for (const task of tasks) {
    it(`writes ${task} in every dialect as the committed translation`, () => {
      for (const target of machineTargetIds) {
        expect(translator.translate(source(task), 'javascript', target)).toBe(
          golden(task, target)
        );
      }
    });
  }

  it('spells each dialect in its own syntax', () => {
    const gcd = source('greatest-common-divisor');
    const gas = translator.translate(gcd, 'javascript', 'gas');
    expect(gas).toContain('# Greatest common divisor in x86-64 assembly');
    expect(gas).toContain('.type greatest_common_divisor, @function');
    expect(gas).toContain('call greatest_common_divisor');
    const arm64 = translator.translate(gcd, 'javascript', 'arm64');
    expect(arm64).toContain('// Greatest common divisor in ARM64 assembly');
    expect(arm64).toContain('stp x29, x30, [sp, #-16]!');
    expect(arm64).toContain('bl greatest_common_divisor');
    const llvm = translator.translate(gcd, 'javascript', 'llvm');
    expect(llvm).toContain('; Greatest common divisor in LLVM IR');
    expect(llvm).toContain('define i64 @greatest_common_divisor(');
    const wat = translator.translate(gcd, 'javascript', 'wat');
    expect(wat).toContain(';; Greatest common divisor in WebAssembly text');
    expect(wat).toContain('(func $greatest_common_divisor');
    expect(wat).toContain('(export "main")');
  });

  it('refuses statements on their own for the new dialects', () => {
    for (const target of dialects) {
      expect(() =>
        translator.translateFragment('x = x + 1;', 'javascript', target)
      ).toThrow('Machine targets hold whole programs only');
    }
  });
});

describe('reading the dialects back', () => {
  for (const task of tasks) {
    it(`lifts ${task} from every dialect to the program lifted from NASM`, () => {
      const expected = withoutComments(
        translator.translate(golden(task, 'nasm'), 'nasm', 'javascript')
      );
      for (const target of dialects) {
        const lifted = translator.translate(
          golden(task, target),
          target,
          'javascript'
        );
        expect(withoutComments(lifted)).toBe(expected);
      }
    });

    it(`writes ${task} again from its own lifted program in every dialect`, () => {
      for (const target of dialects) {
        const lifted = translator.translate(
          golden(task, target),
          target,
          'javascript'
        );
        expect(translator.translate(lifted, 'javascript', target)).toBe(
          golden(task, target)
        );
      }
    });
  }

  it('translates between every pair of dialects', () => {
    const task = 'greatest-common-divisor';
    for (const from of machineTargetIds) {
      for (const to of machineTargetIds) {
        expect(translator.translate(golden(task, from), from, to)).toBe(
          golden(task, to)
        );
      }
    }
  });

  it('reads procedures, slots and text', () => {
    const readers = {
      gas: readGas,
      arm64: readArm64,
      llvm: readLlvm,
      wat: readWat,
    };
    for (const [target, read] of Object.entries(readers)) {
      const program = read(golden('greatest-common-divisor', target));
      expect(program.comments.length).toBe(1);
      expect(program.functions[0].name).toBe('greatest_common_divisor');
      expect(program.functions[0].slotNames).toEqual([
        'first',
        'second',
        'remainder',
      ]);
      expect(program.functions[0].parameterCount).toBe(2);
      expect(
        program.main.code.some(
          ([operation, value]) =>
            operation === 'print-text' &&
            value === 'The greatest common divisor of 1071 and 462 is '
        )
      ).toBe(true);
    }
  });

  it('decodes text that is not plain ASCII', () => {
    const text = 'console.log("Привет, мир! ✓ \\"quoted\\"");\n';
    for (const target of dialects) {
      const machine = translator.translate(text, 'javascript', target);
      expect(translator.translate(machine, target, 'javascript')).toContain(
        'Привет, мир! ✓ \\"quoted\\"'
      );
    }
  });

  it('reports code it does not recognize', () => {
    for (const target of dialects) {
      expect(() => translator.translate('nonsense', target, 'c')).toThrow();
    }
    const broken = golden('factorial', 'gas').replace('imulq', 'mulqq');
    expect(() => translator.translate(broken, 'gas', 'c')).toThrow(
      'Cannot read gas line'
    );
  });

  it('reads a long LLVM text line in linear time', () => {
    const line = `@text.0 =  c"${' c"a'.repeat(50000)}`;
    const start = performance.now();
    expect(() => readLlvm(line)).toThrow();
    expect(performance.now() - start).toBeLessThan(1000);
  });
});
