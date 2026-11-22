import { readFileSync } from 'node:fs';
import { URL } from 'node:url';

import { evaluate } from 'relative-meta-logic';
import { rankInterpretations } from '../../src/index.js';

export function demonstrate() {
  const read = (name) => readFileSync(new URL(name, import.meta.url), 'utf8');
  const { source, candidates } = JSON.parse(read('referents.json'));
  const chosen = rankInterpretations(source, candidates);
  const { results, diagnostics } = evaluate(read('referents.lino'));
  if (
    diagnostics.length ||
    Number(results[0]) !== chosen.preferred[0].confidence[0]
  ) {
    throw new Error(
      `RML evidence differs from the preferred referent: ${JSON.stringify({ results, diagnostics })}`
    );
  }
  return chosen;
}

if (import.meta.main) {
  console.log(JSON.stringify(demonstrate(), null, 2));
}
