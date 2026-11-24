import { readdirSync, readFileSync } from 'node:fs';

const data = new globalThis.URL('../../../data/', import.meta.url);

export default readdirSync(data)
  .filter((name) => name.endsWith('.lino'))
  .sort()
  .map((name) => readFileSync(new globalThis.URL(name, data), 'utf8'));
