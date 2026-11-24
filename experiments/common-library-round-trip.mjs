// Translate every example with the common library into each language, read
// the result back without it and compare with the plain translation.
import { readFileSync, readdirSync } from 'node:fs';
import { translate } from '../js/src/grammar/translator.js';
import { commonLibraryAccess } from '../js/src/grammar/common-library.js';

for (const file of readdirSync('examples/programs').filter((f) =>
  f.endsWith('.js')
)) {
  const source = readFileSync(`examples/programs/${file}`, 'utf8');
  for (const language of Object.keys(commonLibraryAccess)) {
    try {
      const withLibrary = translate(source, 'javascript', language, {
        commonLibrary: true,
      });
      const back = translate(withLibrary, language, 'javascript');
      const plain = translate(
        translate(source, 'javascript', language),
        language,
        'javascript'
      );
      console.log(back === plain ? 'same' : 'DIFF', file, language);
    } catch (error) {
      console.log('ERROR', file, language, error.message.split('\n')[0]);
    }
  }
}
