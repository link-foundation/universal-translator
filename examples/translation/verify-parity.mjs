import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { URL } from 'node:url';

import { createTranslator } from '../../src/index.js';

const binary = resolve(process.argv[2] ?? 'target/debug/universal-translator');
const fixture = (name) => readFileSync(new URL(name, import.meta.url), 'utf8');
const effects = JSON.parse(fixture('effects.json'));
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
for (const mode of ['context-dependent', 'literal', 'same-effect']) {
  const args = ['translate', 'c', 'csharp', '--mode', mode];
  if (rust(args, c) !== translator.translate(c, 'c', 'csharp', { mode })) {
    throw new Error(`JavaScript/Rust mode diverged for ${mode}`);
  }
}
console.log(
  `Verified identical JavaScript and Rust output for ${checked} program forms and all three modes.`
);
