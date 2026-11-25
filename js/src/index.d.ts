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
  parseFragment,
  translate,
  translateFragment,
} from './translator.js';
export declare const fragmentKinds: FragmentKind[];
export type {
  Fragment,
  FragmentKind,
  GrammarTranslator,
  GrammarTranslatorOptions,
  TranslationMode,
  TranslationOptions,
} from './translator.js';
import type { FragmentKind } from './translator.js';
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
/** One entry per natural language (versions are listed by
 * `naturalLanguageVersions`). */
export declare function baseNaturalLanguageIds(): string[];
export interface NaturalLanguageVersion {
  id: string;
  label: string;
  kind: 'full' | 'region' | 'vocabulary' | 'standard';
  words?: number;
  primes?: boolean;
  default: boolean;
}
/** Versions of a natural language: full vocabulary first, then regional
 * spellings, smaller vocabularies down to the semantic primes, standards. */
export declare function naturalLanguageVersions(
  id: string
): NaturalLanguageVersion[];
/** The version that fits the browser languages (navigator.languages). */
export declare function preferredNaturalVersion(
  id: string,
  browserLanguages?: readonly string[]
): string;
/** The version with the vocabulary of the semantic primes, if any. */
export declare function primesVersion(id: string): string | undefined;
export interface LanguageVersion {
  version: string;
  label: string;
  default: boolean;
}
export declare const languageVersions: Record<
  string,
  {
    default: string;
    versions: Record<
      string,
      { label: string; syntax?: Record<string, unknown> }
    >;
  }
>;
/** "python@2" -> { id: "python", version: "2" }. */
export declare function splitVersion(identifier: string): {
  id: string;
  version?: string;
};
/** Versions of a programming language, the default first. */
export declare function versionsOf(id: string): LanguageVersion[];
/** Phrases of one natural language -> phrases of another. */
export declare function commentDictionary(
  from: string,
  to: string
): Map<string, string>;
/** The natural language most words of the comments belong to. */
export declare function detectCommentLanguage(texts: string[]): string;
/** Translate a comment text word by word with the comment dictionary. */
export declare const translateCommentText: CommentTranslator;
/** Translate the comments of a source text in place. */
export declare function translateComments(
  source: string,
  language: string,
  options: { from?: string; to: string; translateComment?: CommentTranslator }
): string;
/** Translate the comments of a meta program. */
export declare function translateProgramComments<T>(
  program: T,
  options: { from?: string; to: string; translateComment?: CommentTranslator }
): T;
import type { CommentTranslator } from './translator.js';
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

export interface TranslationServerOptions {
  translator?: import('./translator.js').GrammarTranslator;
}

/** HTTP API: GET /languages and POST /translate
 * {source, from, to, fragment?, mode?, commonLibrary?} → {output} | {error}. */
export declare function createTranslationServer(
  options?: TranslationServerOptions
): import('node:http').Server;
