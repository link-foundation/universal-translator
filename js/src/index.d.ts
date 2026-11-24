/**
 * Example module type definitions
 * Replace this with your actual type definitions
 */

/**
 * Adds two numbers
 * @param a - First number
 * @param b - Second number
 * @returns Sum of a and b
 */
export declare const add: (a: number, b: number) => number;

/**
 * Multiplies two numbers
 * @param a - First number
 * @param b - Second number
 * @returns Product of a and b
 */
export declare const multiply: (a: number, b: number) => number;

/**
 * Delays execution for specified milliseconds
 * @param ms - Milliseconds to wait
 * @returns Promise that resolves after the delay
 */
export declare const delay: (ms: number) => Promise<void>;

export {
  createGrammarTranslator as createTranslator,
  translate,
} from './grammar/translator.js';
export type {
  GrammarTranslator,
  GrammarTranslatorOptions,
  TranslationMode,
  TranslationOptions,
} from './grammar/translator.js';
export * from './grammar/languages.js';
export declare const machineTargetIds: string[];
export declare const machineTargets: Record<string, Record<string, unknown>>;
export declare function lowerProgram(program: unknown): unknown;
export declare function liftProgram(machine: unknown): unknown;
export declare function readNasm(source: string): unknown;
export declare function readCil(source: string): unknown;
export declare function readJvm(source: string): unknown;
export declare const machineReaders: Record<
  string,
  (source: string) => unknown
>;
import type { Rule } from './grammar/translator.js';
export declare const understandingRules: Rule[];
export declare const meaningRules: Rule[];
export declare const contextRules: Rule[];
export declare function mapComments<T>(
  program: T,
  change: (text: string) => string
): T;
export declare function commentGlossary(
  phrases: { source: string; target: string }[]
): Rule;
export * from './translation/source-document.js';
export * from './translation/program.js';
export * as commonLibrary from './common-library.mjs';
