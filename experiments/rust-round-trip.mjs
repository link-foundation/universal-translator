// JavaScript -> Rust -> JavaScript for every example program (issue 1,
// items 5.6 and 5.7): the Rust text read back must do what the source does.
import { readdirSync, readFileSync } from 'node:fs';
import {
  checkEquivalence,
  createTranslator,
  translate,
} from '../js/src/index.js';

const translator = createTranslator();
for (const file of readdirSync('examples/programs').filter((f) =>
  f.endsWith('.js')
)) {
  const source = readFileSync(`examples/programs/${file}`, 'utf8');
  try {
    const rust = translate(source, 'javascript', 'rust');
    const back = translate(rust, 'rust', 'javascript');
    const forth = translate(back, 'javascript', 'rust');
    const check = checkEquivalence(translator, {
      source,
      from: 'javascript',
      to: 'javascript',
      translation: back,
    });
    console.log(
      file,
      check.equivalent ? 'equivalent' : check.differences.slice(0, 2),
      forth === rust ? 'stable' : 'rust differs'
    );
  } catch (error) {
    console.log(file, 'ERROR', error.message);
  }
}
