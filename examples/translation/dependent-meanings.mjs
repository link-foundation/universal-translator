import { rankInterpretations } from '../../js/src/index.js';
import { formatRecord } from '../../js/src/translation/links.js';
import { evaluate } from 'relative-meta-logic';
import { fixture, referentInput } from './fixtures.mjs';

export function demonstrate() {
  const { source, candidates } = referentInput();
  const chosen = rankInterpretations(source, candidates);
  const { results, diagnostics } = evaluate(fixture('referents.lino'));
  if (
    diagnostics.length ||
    Number(results[0]) !== chosen.preferred[0].confidence[0]
  ) {
    throw new Error(
      'Relative Meta Logic evidence differs from the preferred referent'
    );
  }
  return chosen;
}

if (import.meta.main) {
  for (const candidate of demonstrate().candidates) {
    const [lower, upper] = candidate.confidence;
    console.log(
      formatRecord('candidate', {
        id: candidate.id,
        target: candidate.target,
        lower,
        upper,
        'round-trip': candidate.roundTrip,
      })
    );
  }
}
