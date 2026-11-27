import { createTranslator } from '../js/src/index.js';
import {
  sourceOrigin,
  expressionOrigins,
} from '../js/src/translation/source-origins.js';

const translator = createTranslator();
const source = 'function fib(n) { return n; }\nconsole.log(fib(5));\n';
const result = translator.translatePartial(source, 'javascript', 'bash', {
  fragment: true,
  layout: 'target',
});
const spell = (text, [start, end]) =>
  Buffer.from(text).subarray(start, end).toString();
for (const [text, language] of [
  [source, 'javascript'],
  [result.text, 'bash'],
]) {
  const walk = (value) => {
    if (!value || typeof value !== 'object') {
      return;
    }
    if (value.kind && sourceOrigin(value)) {
      console.log(
        JSON.stringify({
          language,
          kind: value.kind,
          meaning: value,
          own: sourceOrigin(value),
          spans: expressionOrigins(value).flatMap(
            (origin) =>
              origin.spans?.map((span) => spell(origin.source, span)) ?? []
          ),
        })
      );
    }
    Object.values(value).forEach(walk);
  };
  walk(translator.parseFragment(text, language).program);
}
console.log(
  JSON.stringify(
    {
      source,
      result,
      regions: result.regionMap.map((pair) => ({
        source: spell(source, [pair.source.start, pair.source.end]),
        target: spell(result.text, [pair.target.start, pair.target.end]),
      })),
    },
    null,
    2
  )
);
