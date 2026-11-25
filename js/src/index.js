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
  detectLanguage,
  parseFragment,
  parsePartial,
  translate,
  translateFragment,
  translatePartial,
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
  naturalLanguage,
  naturalLanguageIds,
} from './natural/catalog.js';
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
