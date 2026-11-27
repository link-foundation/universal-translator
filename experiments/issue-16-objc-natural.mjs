import assert from 'node:assert/strict';
import {
  createTranslator,
  naturalLanguageIds,
  checkDescription,
} from '../js/src/index.js';
import { sameMeaning } from '../js/src/meta/tree.js';
const t = createTranslator();
const source =
  'int main(int count, char **items) { id people = [Set new]; items++; while (--count) [people add:[String str:*items++]]; [people do:{ :person | printf("%s\\n", [person str]); }]; return 0; }';
const meta = t.toMeta(source, 'objc');
for (const language of naturalLanguageIds()) {
  const text = t.fromMeta(meta, language);
  assert.deepEqual(checkDescription(language), [], language);
  assert.ok(
    sameMeaning(meta, t.toMeta(text, language)),
    `${language}: ${text}`
  );
}
console.log(
  `PASS Objpak operations through ${naturalLanguageIds().length} natural grammars`
);
