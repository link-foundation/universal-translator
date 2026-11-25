/**
 * Example module entry point
 * Replace this with your actual implementation
 */

/**
 * Example function that adds two numbers
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} Sum of a and b
 */
export const add = (a, b) => a + b;

/**
 * Example function that multiplies two numbers
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} Product of a and b
 */
export const multiply = (a, b) => a * b;

/**
 * Example async function
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
export const delay = (ms) =>
  new Promise((resolve) => globalThis.setTimeout(resolve, ms));

export {
  createGrammarTranslator as createTranslator,
  parseFragment,
  translate,
  translateFragment,
} from './translator.js';
export { fragmentKinds } from './translation/fragments.js';
export { grammarLanguageIds, languages } from './formal/languages.js';
export { machineTargetIds, machineTargets } from './formal/machine.js';
export {
  commonLibraryAccess,
  commonLibraryOperations,
  recognizeCommonLibrary,
  spellCommonLibrary,
  useCommonLibrary,
} from './formal/common-library.js';
export { lowerProgram } from './formal/lowering.js';
export { liftProgram } from './formal/lifting.js';
export { formatMeta } from './meta/notation.js';
export {
  machineReaders,
  readCil,
  readJvm,
  readNasm,
} from './formal/machine-reader.js';
export {
  commentGlossary,
  contextRules,
  mapComments,
  meaningRules,
  understandingRules,
} from './formal/rules.js';
export {
  isNaturalLanguage,
  isOwnNaturalLanguage,
  naturalLanguage,
  naturalLanguageIds,
  naturalLanguageSource,
  registerNaturalLanguage,
  unregisterNaturalLanguage,
} from './natural/catalog.js';
export {
  addDefinition,
  cachedLookup,
  createStandard,
  defineWord,
  expandWord,
  knownForm,
  lemmaCandidates,
  lexemeGlosses,
  naturalVocabulary,
  primitiveWords,
  readDefinitionCache,
  readStandard,
  standardEntries,
  standardSize,
  standardWordLimit,
  unknownWords,
  wikidataLanguageCodes,
  wikidataLookup,
  wordsOfText,
  writeDefinitionCache,
  writeStandard,
} from './natural/standards.js';
export {
  languageVocabulary,
  loadLanguageVersion,
  readLanguageVersion,
  vocabularyChanges,
  writeLanguageVersion,
} from './formal/vocabulary.js';
export {
  baseNaturalLanguageIds,
  naturalLanguageVersions,
  preferredNaturalVersion,
  primesVersion,
} from './natural/variants.js';
export {
  languageVersions,
  mergeSyntax,
  registerLanguageVersion,
  splitVersion,
  unregisterLanguageVersion,
  versionsOf,
} from './formal/versions.js';
export {
  commentDictionary,
  detectCommentLanguage,
  translateCommentText,
} from './natural/comments.js';
export {
  translateComments,
  translateProgramComments,
} from './translation/comment-language.js';
export { readNatural } from './natural/reader.js';
export { writeNatural } from './natural/writer.js';
export {
  checkDescription,
  checkText,
  semanticPrimes,
} from './natural/rules.js';
export { createProgramTranslator } from './translation/program.js';
export { rankInterpretations } from './translation/referents.js';
export * as commonLibrary from './common-library.mjs';
export {
  createSourceSyntaxCodec,
  readSourceDocument,
  writeSourceDocument,
} from './translation/source-document.js';
export { createTranslationServer } from './server.js';
