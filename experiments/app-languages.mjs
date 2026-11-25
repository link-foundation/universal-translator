// Lists the language entries and versions the example app shows.
import {
  baseNaturalLanguageIds,
  createTranslator,
  naturalLanguageVersions,
  preferredNaturalVersion,
  versionsOf,
} from '../js/src/index.js';

const translator = createTranslator();
const programming = translator.languages();
console.log('programming', programming.length, programming.slice(0, 3));
console.log(
  'with versions',
  programming
    .filter((l) => versionsOf(l.id).length > 1)
    .map((l) => [l.id, versionsOf(l.id)])
);
const natural = translator.naturalLanguages();
console.log(
  'natural entries',
  natural.length,
  'base',
  baseNaturalLanguageIds().length
);
console.log(naturalLanguageVersions('english'));
console.log(naturalLanguageVersions('russian'));
console.log(preferredNaturalVersion('english', ['en-GB', 'ru']));
console.log(preferredNaturalVersion('english', ['ru-RU']));
