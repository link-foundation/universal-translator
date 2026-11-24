#!/usr/bin/env node
// Write the translation of every program in this folder into every grammar
// language under translated/<task>/. The JavaScript and Rust tests compare
// their output with these files, so both implementations stay in step.
//
//   node examples/programs/write-translations.mjs          # rewrite files
//   node examples/programs/write-translations.mjs --check  # fail on drift

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGrammarTranslator } from '../../js/src/grammar/translator.js';
import { grammarLanguageIds } from '../../js/src/grammar/languages.js';
import { extensions, programFiles } from './verify-native.mjs';

const folder = dirname(fileURLToPath(import.meta.url));
const translator = createGrammarTranslator();

export function expectedTranslations() {
  return programFiles()
    .filter(({ language }) => language === 'javascript')
    .flatMap(({ path, task }) =>
      grammarLanguageIds.map((target) => ({
        task,
        target,
        path: join(folder, 'translated', task, `${task}${extensions[target]}`),
        text: translator.translate(
          readFileSync(path, 'utf8'),
          'javascript',
          target
        ),
      }))
    );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  let drift = 0;
  for (const { path, text } of expectedTranslations()) {
    if (check) {
      if (!existsSync(path) || readFileSync(path, 'utf8') !== text) {
        drift += 1;
        console.log(`DRIFT ${path}`);
      }
      continue;
    }
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
  }
  process.exitCode = drift ? 1 : 0;
}
