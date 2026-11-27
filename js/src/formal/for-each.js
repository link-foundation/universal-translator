// The for-each loop of the meta language is lowered and raised in
// meta/for-each.js; this rule decides which languages keep it.

import { languageSyntax } from './languages.js';
import { isPlain, lowerForEach } from '../meta/for-each.js';

export { raiseForEach } from '../meta/for-each.js';

// Languages without a for-each loop write a counting loop over an index, and
// so do loops that change their own variable or array.
export function expandForEach(program, { to, target = to }) {
  const native = Boolean(languageSyntax(target).forEach);
  return lowerForEach(
    program,
    (loop) =>
      (native || (to === 'objc' && loop.array.type === 'set<text>')) &&
      isPlain(loop)
  );
}
