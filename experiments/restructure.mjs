// One-off: move js/src/grammar into js/src/meta (shared tree, truth, types,
// Links Notation reading) and js/src/formal (programming and machine
// languages), and rewrite every relative import that pointed at a moved file.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

const moves = {
  'js/src/grammar/meta.js': 'js/src/meta/tree.js',
  'js/src/grammar/truth.js': 'js/src/meta/truth.js',
  'js/src/grammar/types.js': 'js/src/meta/types.js',
  'js/src/translation/links.js': 'js/src/meta/links.js',
  'js/src/grammar/translator.js': 'js/src/translator.js',
  'js/src/grammar/translator.d.ts': 'js/src/translator.d.ts',
};
const listed = execSync('git ls-files js/src/grammar', { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean);
for (const file of listed) {
  moves[file] ??= file.replace('js/src/grammar/', 'js/src/formal/');
}
const root = process.cwd();
const newPath = (file) => moves[file] ?? file;

const sources = execSync("git ls-files '*.js' '*.mjs' '*.ts' '*.mts' '*.jsx'", {
  encoding: 'utf8',
})
  .split('\n')
  .filter(Boolean);

const rewritten = new Map();
for (const file of sources) {
  const text = readFileSync(file, 'utf8');
  const from = dirname(resolve(root, file));
  const to = dirname(resolve(root, newPath(file)));
  const next = text.replace(
    /((?:from|import)\s*\(?\s*['"])(\.{1,2}\/[^'"]+)(['"])/g,
    (whole, before, specifier, after) => {
      const target = relative(root, resolve(from, specifier));
      const moved = newPath(target);
      if (!moves[target] && from === to) {
        return whole;
      }
      let spec = relative(to, resolve(root, moved));
      if (!spec.startsWith('.')) {
        spec = `./${spec}`;
      }
      return `${before}${spec}${after}`;
    }
  );
  if (next !== text) {
    rewritten.set(file, next);
  }
}
for (const [from, to] of Object.entries(moves)) {
  execSync(`mkdir -p ${dirname(to)} && git mv ${from} ${to}`);
}
for (const [file, text] of rewritten) {
  writeFileSync(newPath(file), text);
}
console.log(`moved ${Object.keys(moves).length}, rewrote ${rewritten.size}`);
console.log(existsSync('js/src/grammar') ? 'grammar dir remains' : 'ok');
