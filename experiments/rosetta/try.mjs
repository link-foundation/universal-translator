import { readFileSync, readdirSync } from 'node:fs';
import { createGrammarTranslator } from '../../js/src/translator.js';
import { grammarLanguageIds } from '../../js/src/formal/languages.js';
import { machineTargetIds } from '../../js/src/formal/machine.js';
const t = createGrammarTranslator();
for (const f of readdirSync('../../examples/programs').filter((f) =>
  f.endsWith('.js')
)) {
  const src = readFileSync(`../../examples/programs/${f}`, 'utf8');
  for (const target of [...grammarLanguageIds, ...machineTargetIds]) {
    try {
      t.translate(src, 'javascript', target);
    } catch (e) {
      console.log(f, target, e.message.split('\n')[0]);
    }
  }
}
