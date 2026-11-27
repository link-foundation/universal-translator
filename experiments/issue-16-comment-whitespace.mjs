// Finite audit: changing comment words must not change the surrounding layout.
import {
  createTranslator,
  grammarLanguageIds,
  machineTargetIds,
  naturalLanguageIds,
} from '../js/src/index.js';
import { languageSyntax } from '../js/src/formal/languages.js';
import { execFileSync } from 'node:child_process';

const before = process.argv.includes('--before');
let makeTranslator = createTranslator;
if (before) {
  // Load translation/layout stages independently of their dependencies.
  const previous = (path) =>
    execFileSync('git', ['show', `eeb793d:${path}`], {
      encoding: 'utf8',
      maxBuffer: 256 * 1024,
    });
  const moduleUrl = (source) =>
    `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  const oldLayout = moduleUrl(previous('js/src/translation/layout.js'));
  const oldTranslator = previous('js/src/translator.js').replace(
    /from '([.][^']+)'/g,
    (_, relative) =>
      `from ${JSON.stringify(
        relative === './translation/layout.js'
          ? oldLayout
          : new URL(
              relative,
              new URL('../js/src/translator.js', import.meta.url)
            ).href
      )}`
  );
  ({ createGrammarTranslator: makeTranslator } = await import(
    moduleUrl(oldTranslator)
  ));
}
const translator = makeTranslator();
const source = '# spaceprobeone\n\nn = 1\n# spaceprobetwo\nprint(n)\n';
const translateComment = (text) =>
  text
    .replaceAll('spaceprobeone', 'пробелодин')
    .replaceAll('spaceprobetwo', 'пробелдва');
const languages = [
  ...grammarLanguageIds,
  ...machineTargetIds,
  ...naturalLanguageIds(),
];
const failures = [];
let checked = 0;
for (const from of languages) {
  try {
    const original = translator.translate(source, 'python', from);
    // Keep generated runtime headers intact; the surrounding program uses
    // CRLF, leading/trailing blank lines and its own comment paragraphs.
    const header = naturalLanguageIds().includes(from)
      ? ''
      : (languageSyntax(from).header ?? '');
    const decorated = `${header}\r\n${original.slice(header.length).replaceAll('\n', '\r\n')}\r\n`;
    for (const to of new Set([from, 'python', 'bash', 'english', 'nasm'])) {
      checked += 1;
      const baseline = translator.translatePartial(
        decorated,
        from,
        to,
        from === to
          ? {
              commentFrom: 'english',
              commentLanguage: 'english',
              translateComment: (text) => text,
            }
          : {}
      );
      const result = translator.translatePartial(decorated, from, to, {
        commentFrom: 'english',
        commentLanguage: 'russian',
        translateComment,
      });
      const restored = result.text
        .replaceAll('пробелодин', 'spaceprobeone')
        .replaceAll('пробелдва', 'spaceprobetwo');
      if (!result.complete || restored !== baseline.text) {
        failures.push({
          from,
          to,
          kind: 'comment-toggle',
          baseline: baseline.text,
          result: result.text,
          complete: result.complete,
        });
      }
      if (from === to && result.text !== translateComment(decorated)) {
        failures.push({
          from,
          to,
          kind: 'same-language',
          source: decorated,
          result: result.text,
        });
      }
    }
  } catch (error) {
    failures.push({ from, kind: 'exception', error: error.message });
  }
}
console.log(
  JSON.stringify(
    {
      stages: before ? 'eeb793d' : 'current',
      languages: languages.length,
      checked,
      failures,
    },
    null,
    2
  )
);
process.exitCode = Number(failures.length !== 0);
