// Finite inventory: a semantic round trip is not a native execution claim.
import { createTranslator, naturalLanguageIds } from '../js/src/index.js';
import { meaningDifference } from '../js/src/meta/tree.js';

const translator = createTranslator();
const sources = [
  ['python', 'print(-7 // 3)\nprint(-7 % 3)\n'],
  [
    'c',
    'int main(void) { printf("%d\\n", -7 / 3); printf("%d\\n", -7 % 3); return 0; }',
  ],
];
const languages = [
  ...translator.languages().map((l) => l.id),
  ...naturalLanguageIds(),
];
const results = sources.flatMap(([from, source]) => {
  const meta = translator.toMeta(source, from);
  return languages.map((to) => {
    try {
      const written = translator.fromMeta(meta, to);
      const difference = meaningDifference(
        meta,
        translator.toMeta(written, to)
      );
      return {
        from,
        to,
        ...(difference ? { difference, written } : { pass: true }),
      };
    } catch (error) {
      if (to === 'sql' && /requires selection queries/.test(error.message)) {
        return { from, to, unsupported: error.message };
      }
      return { from, to, error: error.message };
    }
  });
});
console.log(
  JSON.stringify(
    {
      cases: results.length,
      passed: results.filter((r) => r.pass).length,
      unsupported: results.filter((r) => r.unsupported),
      failures: results.filter((r) => !r.pass && !r.unsupported),
      results,
    },
    null,
    2
  )
);
process.exitCode = Number(results.some((r) => !r.pass && !r.unsupported));
