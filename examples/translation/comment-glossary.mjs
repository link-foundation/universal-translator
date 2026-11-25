// Translate Russian comments in a C# program to English while keeping the
// code. The glossary lives in data/translation/comment-glossary.lino and
// becomes one meta -> meta layer.
//
//   node examples/translation/comment-glossary.mjs [file.cs]

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { commentGlossary, createTranslator } from '../../js/src/index.js';
import {
  linkFields,
  namedLinks,
  parseLinks,
  reference,
} from '../../js/src/meta/links.js';
import { fixture, translationData } from './fixtures.mjs';

export function glossaryPhrases() {
  const [glossary] = namedLinks(
    parseLinks(translationData('comment-glossary.lino')),
    'glossary'
  );
  return glossary
    .filter(({ id }) => id === 'phrase')
    .map(({ values }) => {
      const fields = linkFields(values);
      return {
        source: reference(fields.get('source')),
        target: reference(fields.get('target')),
      };
    });
}

export function translateComments(source) {
  const translator = createTranslator({
    layers: [[commentGlossary(glossaryPhrases())]],
  });
  return translator.translate(source, 'csharp', 'csharp');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  process.stdout.write(
    translateComments(
      file ? readFileSync(file, 'utf8') : fixture('hello-ru.cs')
    )
  );
}
