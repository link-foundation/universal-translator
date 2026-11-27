// Compile with TypeScript's NodeNext module and resolution settings.
import {
  createTranslator,
  type ByteRange,
  type PartialTranslation,
  type TranslationRegion,
} from '@link-foundation/universal-translator';

const source = 'console.log("Привет 🌍");';
const result: PartialTranslation = createTranslator().translatePartial(
  source,
  'javascript',
  'python',
  { fragment: true }
);
const bytes = new TextEncoder().encode(source);
const read = ({ start, end }: ByteRange) =>
  new TextDecoder().decode(bytes.subarray(start, end));
for (const region of result.regionMap satisfies TranslationRegion[]) {
  console.log(read(region.source), region.target);
}
