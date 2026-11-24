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
  translate,
} from './grammar/translator.js';
export { grammarLanguageIds, languages } from './grammar/languages.js';
export { machineTargetIds, machineTargets } from './grammar/machine.js';
export { lowerProgram } from './grammar/lowering.js';
export {
  commentGlossary,
  contextRules,
  mapComments,
  meaningRules,
  understandingRules,
} from './grammar/rules.js';
export { createProgramTranslator } from './translation/program.js';
export { rankInterpretations } from './translation/referents.js';
export * as commonLibrary from './common-library.mjs';
export {
  createSourceSyntaxCodec,
  readSourceDocument,
  writeSourceDocument,
} from './translation/source-document.js';
