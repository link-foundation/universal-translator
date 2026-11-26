// The language pickers of the web app: one entry per language, machine code
// targets marked so the picker lists them in a group of their own.
import { describe, it, expect } from 'test-anywhere';
import { createTranslator } from '../src/index.js';
import { languageEntries } from '../../examples/universal-app/src/languages.js';

const MACHINE = ['nasm', 'gas', 'arm64', 'llvm', 'wat', 'cil', 'jvm'];

describe('Web app language entries', () => {
  const entries = languageEntries(createTranslator());

  it('marks every machine code target', () => {
    const machine = entries.filter((entry) => entry.machine);
    expect(machine.map((entry) => entry.id).sort()).toEqual(
      [...MACHINE].sort()
    );
    for (const entry of machine) {
      expect(entry.group).toBe('programming');
      expect(entry.versions.map((version) => version.id)).toContain(entry.id);
    }
  });

  it('leaves the text languages unmarked', () => {
    const python = entries.find((entry) => entry.id === 'python');
    expect(python.machine).toBe(undefined);
    expect(entries.some((entry) => entry.group === 'natural')).toBe(true);
  });
});
