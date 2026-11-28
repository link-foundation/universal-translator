// Trace the finite LLVM helper round trip without enabling global verbosity.
import { writeFileSync } from 'node:fs';
import { createTranslator } from '../js/src/index.js';
import { machineReaders } from '../js/src/formal/machine-reader.js';
const translator = createTranslator();
const written = translator.translate(
  'print(-7 // 3)\nprint(-7 % 3)\n',
  'python',
  'llvm'
);
const base = new URL('../docs/case-studies/issue-16/logs/', import.meta.url);
writeFileSync(new URL('integer-rounding.ll', base), written);
writeFileSync(
  new URL('integer-rounding-llvm-read.json', base),
  JSON.stringify(machineReaders.llvm(written), null, 2)
);
translator.toMeta(written, 'llvm');
