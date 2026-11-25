import { createGrammarTranslator } from '../js/src/translator.js';
import { meaningDifference } from '../js/src/meta/tree.js';
import { readFileSync, readdirSync } from 'node:fs';
import { extensions } from '../examples/programs/verify-native.mjs';
const t = createGrammarTranslator();
for (const f of readdirSync('examples/programs/hand-written')) {
  const [task, ext] = [
    f.slice(0, f.lastIndexOf('.')),
    f.slice(f.lastIndexOf('.')),
  ];
  const lang = Object.keys(extensions).find((k) => extensions[k] === ext);
  try {
    const d = meaningDifference(
      t.toMeta(
        readFileSync(`examples/programs/${task}.js`, 'utf8'),
        'javascript'
      ),
      t.toMeta(
        readFileSync(`examples/programs/hand-written/${f}`, 'utf8'),
        lang
      )
    );
    console.log(d ? `DIFF ${f} ${d.slice(0, 300)}` : `SAME ${f}`);
  } catch (e) {
    console.log(`ERR ${f} ${e.message}`);
  }
}
