// Compare plain and common-library translations read back to JavaScript.
import { readFileSync } from 'node:fs';
import { translate } from '../js/src/translator.js';
import { commonLibraryAccess } from '../js/src/formal/common-library.js';

const name = process.argv[2] ?? 'hello-world';
const source = readFileSync(`examples/programs/${name}.js`, 'utf8');
for (const language of Object.keys(commonLibraryAccess)) {
  const plain = translate(source, 'javascript', language);
  const library = translate(source, 'javascript', language, {
    commonLibrary: true,
  });
  const a = translate(plain, language, 'javascript');
  const b = translate(library, language, 'javascript');
  if (a !== b) {
    console.log(
      `--- ${language}\n${library}\n=== plain back\n${a}=== library back\n${b}`
    );
  }
}
