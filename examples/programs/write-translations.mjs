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
import { createGrammarTranslator } from '../../js/src/translator.js';
import { grammarLanguageIds } from '../../js/src/formal/languages.js';
import { machineTargetIds } from '../../js/src/formal/machine.js';
import { extensions, programFiles } from './verify-native.mjs';

const folder = dirname(fileURLToPath(import.meta.url));
const translator = createGrammarTranslator();

export function expectedTranslations() {
  return programFiles()
    .filter(({ language }) => language === 'javascript')
    .flatMap(({ path, task }) =>
      [...grammarLanguageIds, ...machineTargetIds].map((target) => ({
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

/**
 * Write every expected file, or with --check only report the files that
 * differ. Sets the exit code to 1 when a file drifted.
 */
export function writeOrCheck(files, argv = process.argv) {
  const check = argv.includes('--check');
  let drift = 0;
  for (const { path, text } of files) {
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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeOrCheck(expectedTranslations());
}
