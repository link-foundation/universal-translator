import { createGrammarTranslator } from '../js/src/grammar/translator.js';
import { sameMeaning } from '../js/src/grammar/meta.js';
import { readFileSync, readdirSync } from 'node:fs';
const t = createGrammarTranslator();
const strip=(m)=>m;
let bad=0;
for (const f of readdirSync('examples/programs').filter(f=>f.endsWith('.js'))) {
  const src = readFileSync('examples/programs/'+f,'utf8');
  const meta = t.toMeta(src,'javascript');
  for (const {id} of t.languages()) {
    try {
      const code = t.translate(src,'javascript',id);
      const back = t.toMeta(code,id);
      if (!sameMeaning(meta, back)) { bad++; console.log('DIFF', f, id); console.log(JSON.stringify(meta.main).slice(0,400)); console.log(JSON.stringify(back.main).slice(0,400)); }
      const again = t.translate(code,id,'javascript',{mode:'literal'});
    } catch(e){ bad++; console.log('ERR', f, id, e.message); }
  }
}
console.log('bad', bad);
