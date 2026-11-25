#!/usr/bin/env node
// Write every program in this folder in every controlled natural language
// under natural/<task>/<task>.<language>.txt. The JavaScript and Rust tests
// compare their output with these files, read each one back to the same
// meaning, and check it keeps the rules of its controlled language.
//
//   node examples/programs/write-natural.mjs          # rewrite files
//   node examples/programs/write-natural.mjs --check  # fail on drift

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGrammarTranslator } from '../../js/src/translator.js';
import { naturalLanguageIds } from '../../js/src/natural/catalog.js';
import { programFiles } from './verify-native.mjs';

const folder = dirname(fileURLToPath(import.meta.url));
const translator = createGrammarTranslator();

export function expectedNaturalTexts() {
  return programFiles()
    .filter(({ language }) => language === 'javascript')
    .flatMap(({ path, task }) => {
      const meta = translator.toMeta(readFileSync(path, 'utf8'), 'javascript');
      return naturalLanguageIds()
        .sort()
        .map((language) => ({
          task,
          language,
          meta,
          path: join(folder, 'natural', task, `${task}.${language}.txt`),
          text: translator.fromMeta(meta, language),
        }));
    });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  let drift = 0;
  for (const { path, text } of expectedNaturalTexts()) {
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
