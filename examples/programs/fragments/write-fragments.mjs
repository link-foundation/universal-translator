#!/usr/bin/env node
// Write the translation of every fragment in this folder (a statement, a
// block, functions or a whole program) into every grammar language under
// translated/<fragment>/. The JavaScript and Rust tests compare their output
// with these files and read each of them back into the same JavaScript
// fragment, so both implementations stay in step.
//
//   node examples/programs/fragments/write-fragments.mjs          # rewrite
//   node examples/programs/fragments/write-fragments.mjs --check  # drift

import { readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGrammarTranslator } from '../../../js/src/translator.js';
import { grammarLanguageIds } from '../../../js/src/formal/languages.js';
import { extensions } from '../verify-native.mjs';
import { writeOrCheck } from '../write-translations.mjs';

const folder = dirname(fileURLToPath(import.meta.url));
const translator = createGrammarTranslator();

/** Every JavaScript fragment in this folder: its name and its source. */
export function fragmentSources() {
  return readdirSync(folder)
    .filter((file) => file.endsWith('.js'))
    .sort()
    .map((file) => ({
      name: basename(file, '.js'),
      source: readFileSync(join(folder, file), 'utf8'),
    }));
}

/** The golden file of a fragment in a language. */
export function fragmentPath(name, language) {
  return join(folder, 'translated', name, `${name}${extensions[language]}`);
}

export function expectedFragments() {
  return fragmentSources().flatMap(({ name, source }) =>
    grammarLanguageIds.map((target) => ({
      name,
      target,
      path: fragmentPath(name, target),
      text: translator.translateFragment(source, 'javascript', target),
    }))
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeOrCheck(expectedFragments());
}
