import { createTranslator } from '../js/src/index.js';
const translator = createTranslator();
for (const source of [
  'values = [p + 1 for p in [1, 2]]',
  'def values():\n    return [p + 1 for p in [1, 2]]',
  'def values():\n    return (p + 1 for p in [1, 2])',
  'p = 3.5\nvalues = [p + 1 for p in [1, 2]]',
  'values = [[p.age for p in p.children] for p in people]',
]) {
  console.log(
    JSON.stringify({
      source,
      meta: translator.toMeta(source, 'python'),
      csharp: translator.translate(source, 'python', 'csharp'),
    })
  );
}
