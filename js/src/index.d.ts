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
} from './translator.js';
export type {
  GrammarTranslator,
  GrammarTranslatorOptions,
  TranslationMode,
  TranslationOptions,
} from './translator.js';
export * from './formal/languages.js';
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
/** Whether `id` names a controlled natural language (or profile). */
export declare function isNaturalLanguage(id: string): boolean;
/** Ids of every controlled natural language and profile. */
export declare function naturalLanguageIds(): string[];
/** The compiled description of a controlled natural language. */
export declare function naturalLanguage(id: string): Record<string, unknown>;
/** Controlled natural language text -> meta program. */
export declare function readNatural(text: string, id: string): unknown;
/** Meta program -> controlled natural language text. */
export declare function writeNatural(program: unknown, id: string): string;
/** Problems with a language description (empty when it keeps its rules). */
export declare function checkDescription(id: string): string[];
/** Problems with a text written in the language (empty when it keeps its rules). */
export declare function checkText(text: string, id: string): string[];
/** The 65 semantic primes of Natural Semantic Metalanguage. */
export declare function semanticPrimes(): {
  prime: string;
  category: string;
  exponents: Record<string, string[]>;
}[];
import type { Rule } from './translator.js';
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
export declare const commonLibraryOperations: string[];
export declare const commonLibraryAccess: Record<
  string,
  { imports?: (names: string[]) => string[]; prefix?: string }
>;
export declare function useCommonLibrary<T>(program: T): T;
export declare const recognizeCommonLibrary: Rule;
export declare const spellCommonLibrary: Rule;
export * as commonLibrary from './common-library.mjs';
