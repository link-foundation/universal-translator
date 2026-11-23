import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

import {
  createTranslator,
  languageProfiles,
  readSourceDocument,
  writeEffect,
  writeSourceDocument,
} from '../../js/src/index.js';

import { exampleEffects, fixture, localizedGreetings } from './fixtures.mjs';

const binary = resolve(process.argv[2] ?? 'target/debug/universal-translator');
const effects = exampleEffects();
const translator = createTranslator();
const languages = translator.listLanguages();
const rust = (args, input) =>
  execFileSync(binary, args, { encoding: 'utf8', input });
let checked = 0;
for (const { id, forms } of languages) {
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
for (const effect of effects) {
  for (const [from, to] of [
    ['javascript', 'rust'],
    ['rust', 'javascript'],
  ]) {
    const input = translator.materialize(translator.expression(from, effect));
    const meta = translator.translate(input, from, 'meta');
    assert.equal(rust(['translate', from, 'meta'], input), meta);
    if (
      !languages
        .find(({ id }) => id === to)
        ?.forms.some(
          ({ task, name }) => task === effect.task && name === 'common'
        )
    ) {
      continue;
    }
    const common = translator.translate(meta, 'meta', to, { form: 'common' });
    assert.equal(
      rust(['translate', 'meta', to, '--form', 'common'], meta),
      common
    );
    assert.equal(rust(['translate', to, 'meta'], common), meta);
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
for (const [language, source] of [
  ['JavaScript', '\ufeff// 🦀\r\nconst text = "example";\r\n'],
  ['Rust', 'fn main() {\n    println!("Bonjour");\n}\n'],
  ['Other language', '\na\n\n  b\t'],
  ['Empty source', ''],
]) {
  const jsNotation = writeSourceDocument(language, source);
  const rustNotation = rust(['encode-source', language], source);
  assert.deepEqual(readSourceDocument(rustNotation), { language, source });
  assert.equal(rust(['decode-source'], jsNotation), source);
}
console.log(
  `Verified identical JavaScript and Rust output for ${checked} program forms, ${localized.length} localized greetings, all three modes, and bidirectional common library forms.`
);
