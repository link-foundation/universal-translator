// Every locale of the web demo catalog has every key of the English one.
import { readFileSync } from 'node:fs';
import { readCatalogs } from '@link-foundation/ui-i18n';
const catalogs = readCatalogs(readFileSync(process.argv[2], 'utf8'));
const flat = (o, p = '') =>
  Object.entries(o).flatMap(([k, v]) =>
    typeof v === 'object' && v ? flat(v, `${p}${k}.`) : [p + k]
  );
console.log(Object.keys(catalogs), typeof catalogs.en);
const en = new Set(flat(catalogs.en));
for (const [l, c] of Object.entries(catalogs)) {
  const keys = new Set(flat(c));
  const missing = [...en].filter((k) => !keys.has(k));
  console.log(l, keys.size, missing);
}
