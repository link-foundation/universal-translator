import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

import {
  createTranslator,
  languageProfiles,
  writeEffect,
} from '../../src/index.js';

import { exampleEffects, fixture, localizedGreetings } from './fixtures.mjs';

const binary = resolve(process.argv[2] ?? 'target/debug/universal-translator');
const effects = exampleEffects();
const translator = createTranslator();
const rust = (args, input) =>
  execFileSync(binary, args, { encoding: 'utf8', input });
let checked = 0;
for (const { id, forms } of translator.listLanguages()) {
  for (const { task, name } of forms) {
    const effect = effects.find(({ task: candidate }) => candidate === task);
    const input = translator.materialize(
      translator.expression('javascript', effect)
    );
    const args = ['translate', 'javascript', id, '--form', name];
    const expected = translator.translate(input, 'javascript', id, {
      form: name,
    });
    const emitted = rust(args, input);
    if (emitted !== expected || rust(['roundtrip', id], emitted) !== expected) {
      throw new Error(
        `JavaScript/Rust output diverged for ${id} ${task}/${name}`
      );
    }
    checked += 1;
  }
}
const c = fixture('hello.c');
const localized = localizedGreetings();
const greetingProfiles = languageProfiles().filter(
  ({ kind, unicodeGreeting }) => kind === 'natural-language' || unicodeGreeting
);
for (const [index, effect] of localized.entries()) {
  const { id } = greetingProfiles[index % greetingProfiles.length];
  const meta = writeEffect(effect);
  const source = translator.translate(meta, 'meta', id);
  if (
    rust(['translate', 'meta', id], meta) !== source ||
    rust(['translate', id, 'meta'], source) !== `${meta}\n`
  ) {
    throw new Error(`JavaScript/Rust localized greeting differs for ${id}`);
  }
}
for (const mode of ['context-dependent', 'literal', 'same-effect']) {
  const args = ['translate', 'c', 'csharp', '--mode', mode];
  if (rust(args, c) !== translator.translate(c, 'c', 'csharp', { mode })) {
    throw new Error(`JavaScript/Rust mode diverged for ${mode}`);
  }
  const meta = rust(['translate', 'c', 'meta', '--mode', mode], c);
  if (meta !== translator.translate(c, 'c', 'meta', { mode })) {
    throw new Error(`JavaScript/Rust Links Notation differs in ${mode} mode`);
  }
  if (
    rust(['translate', 'meta', 'ja', '--mode', mode], meta) !==
    translator.translate(meta, 'meta', 'ja', { mode })
  ) {
    throw new Error(
      `JavaScript/Rust translation from Links Notation differs in ${mode} mode`
    );
  }
}
console.log(
  `Verified identical JavaScript and Rust output for ${checked} program forms, ${localized.length} localized greetings, and all three modes.`
);
