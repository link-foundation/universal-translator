// How often the random example buttons find a working example, per kind.
import { readdirSync, readFileSync } from 'node:fs';
import { createTranslator } from '../js/src/index.js';
import {
  exampleKinds,
  randomExample,
} from '../examples/universal-app/src/examples.js';

const translator = createTranslator();
const programs = Object.fromEntries(
  readdirSync('examples/programs')
    .filter((name) => name.endsWith('.js'))
    .map((name) => [
      name.slice(0, -3),
      readFileSync(`examples/programs/${name}`, 'utf8'),
    ])
);
const languages = [
  ...translator.languages().map((it) => it.id),
  ...translator.naturalLanguages().map((it) => it.id),
];
let seed = Number(process.env.SEED ?? 1);
const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
for (const kind of exampleKinds) {
  let found = 0;
  const started = Date.now();
  const runs = Number(process.env.RUNS ?? 20);
  for (let run = 0; run < runs; run++) {
    const example = randomExample(translator, {
      programs,
      languages,
      kind,
      random,
      attempts: 1,
    });
    if (example) {
      found++;
      if (run < 2) {
        console.log(
          kind,
          example.task,
          example.from,
          '->',
          example.to,
          `\n${example.source}`
        );
      }
    }
  }
  console.log(
    kind,
    `${found}/${runs} single attempts work`,
    `${Date.now() - started} ms`
  );
}
