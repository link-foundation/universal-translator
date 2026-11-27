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
  parsePartial,
  translate,
  translateCandidates,
  translateFragment,
} from './translator.js';
export declare const fragmentKinds: FragmentKind[];
export { reconstructConcrete } from './translation/concrete-syntax.js';
export type {
  ConcreteLeaf,
  ConcreteSyntax,
} from './translation/concrete-syntax.js';
export declare const stageNames: import('./translator.js').StageName[];
export declare function decorateStages(
  stages: import('./translator.js').Stages,
  decorate?: import('./translator.js').Decorators
): import('./translator.js').Stages;
export type {
  TranslationCandidate,
  Fragment,
  FragmentKind,
  PartialError,
  PartialReading,
  GrammarTranslator,
  GrammarTranslatorOptions,
  Decorator,
  Decorators,
  StageName,
  Stages,
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
  kind: 'full' | 'region' | 'vocabulary' | 'standard' | 'own';
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
  /** Added with registerLanguageVersion. */
  custom?: boolean;
}
/** Syntax with the changes of a version, nested tables merged key by key. */
export declare function mergeSyntax<T extends Record<string, unknown>>(
  syntax: T,
  changes: Record<string, unknown>
): T;
/** Add a version of one's own ("python@mine"); returns its identifier. */
export declare function registerLanguageVersion(
  id: string,
  version: string,
  options: { label?: string; syntax?: Record<string, unknown> }
): string;
export declare function unregisterLanguageVersion(
  id: string,
  version: string
): void;
export interface VocabularyEntry {
  /** A meta language concept: "operators.and", "template:if", "prime:want". */
  concept: string;
  words: string[];
  list?: boolean;
}
/** The words of a programming language and the concepts they spell. */
export declare function languageVocabulary(id: string): VocabularyEntry[];
/** Changed entries -> the syntax changes of a version. */
export declare function vocabularyChanges(
  id: string,
  entries: readonly { concept: string; words: string[] }[]
): Record<string, unknown>;
export interface SavedLanguageVersion {
  language: string;
  version: string;
  label?: string;
  /** The version it is made from ("2" for python@2); none for the default. */
  base?: string;
  syntax: Record<string, unknown>;
}
export declare function writeLanguageVersion(
  version: SavedLanguageVersion
): string;
export declare function readLanguageVersion(
  source: string
): SavedLanguageVersion;
/** Read a saved version and register it; returns "<language>@<version>". */
export declare function loadLanguageVersion(source: string): string;
/** Add a natural language standard of one's own (Links Notation, like
 * data/natural); returns its id. */
export declare function registerNaturalLanguage(source: string): string;
export declare function unregisterNaturalLanguage(id: string): void;
export declare function isOwnNaturalLanguage(id: string): boolean;
/** The Links Notation description of a natural language. */
export declare function naturalLanguageSource(id: string): string;
/** Every word of a natural language and the concept it stands for. */
export declare function naturalVocabulary(id: string): VocabularyEntry[];
export declare const standardWordLimit: number;
export interface Standard {
  id: string;
  language: string;
  limit: number;
  /** Prime exponents and grammatical words: word -> "prime:<id>" | "grammar". */
  primitives: Map<string, string>;
  /** Composite words: word -> definition. */
  definitions: Map<string, string>;
}
export declare function createStandard(options?: {
  id?: string;
  language?: string;
  words?: Record<string, string>;
  limit?: number;
}): Standard;
export declare function primitiveWords(language: string): Map<string, string>;
export declare function standardSize(standard: Standard): number;
export declare function knownForm(
  standard: Standard,
  word: string
): string | undefined;
export declare function unknownWords(
  standard: Standard,
  definition: string
): string[];
export declare function addDefinition(
  standard: Standard,
  word: string,
  definition: string
): string;
export declare function standardEntries(standard: Standard): {
  word: string;
  kind: 'prime' | 'grammar' | 'composite';
  meaning?: string;
  definition?: string;
}[];
/** A word expanded down to primitive words. */
export declare function expandWord(standard: Standard, word: string): string;
export type DefinitionLookup = (
  word: string,
  language: string
) => Promise<string[] | undefined>;
export interface DefinitionResult {
  word: string;
  defined: boolean;
  added: { word: string; definition: string }[];
  missing: string[];
  lookups: number;
}
/** Define a word and, recursively, the unknown words of its definition. */
export declare function defineWord(
  standard: Standard,
  word: string,
  options?: { lookup?: DefinitionLookup; depth?: number; budget?: number }
): Promise<DefinitionResult>;
export declare function cachedLookup(
  table: Record<string, string[]>
): DefinitionLookup;
export declare const wikidataLanguageCodes: Record<string, string>;
/** Definitions from the glosses of Wikidata lexemes, through a cache. */
export declare function wikidataLookup(options?: {
  fetch?: typeof globalThis.fetch;
  cache?: Map<string, string[]>;
  limit?: number;
  interval?: number;
  retries?: number;
  timeout?: number;
  wait?: (milliseconds: number) => Promise<void>;
}): DefinitionLookup;
export declare function lexemeGlosses(
  lexemes: readonly unknown[],
  word: string,
  code: string
): string[];
export declare function lemmaCandidates(
  word: string,
  language?: string
): string[];
export declare function wordsOfText(text: string): string[];
export declare function writeDefinitionCache(
  cache: Map<string, string[]>
): string;
export declare function writeStandard(standard: Standard): string;
export declare function readStandard(source: string): Standard;
export declare function readDefinitionCache(
  source: string
): Map<string, string[]>;
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
/** The candidate translations of a text of prose, the most probable first. */
export declare function rankProse(
  text: string,
  options: { from: string; to: string }
): {
  text: string;
  probability: number;
  frequency: number;
  roundTrip: number;
}[];
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
export * as grammarEngine from './grammar/engine.js';
export * from './grammar/workspace.js';
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

/** Translation rules as indented Links Notation (JSON text is read too):
 * "source:", "templates:", "names:" and "output:", one rule per line. */
export declare function readRules(
  text: string
): import('./translator.js').TranslationRules;
/** Translation rules written as indented Links Notation ('' for none). */
export declare function formatRules(
  rules: import('./translator.js').TranslationRules
): string;
export declare const ruleStages: readonly [
  'source',
  'templates',
  'names',
  'output',
];

/** A meta program (or fragment) as indented Links Notation: one line per
 * node, its kind and plain fields first, child nodes indented below. */
export declare function formatMeta(program: unknown): string;
/** Concepts of the meta language -> calls to its standard library. */
export declare function generalize<T>(tree: T): T;
/** Calls to the standard library of the meta language -> concepts. */
export declare function specialize<T>(tree: T): T;
/** The procedures of the standard library and the concepts they stand for. */
export declare const standardProcedures: Readonly<
  Record<
    string,
    {
      concept: string;
      parameters: readonly string[];
      fields?: Record<string, unknown>;
      statement?: boolean;
      returns?: string;
    }
  >
>;
/** Comments and strings of a meta program read with the grammars they are
 * written in (prose, quoted code); long texts move to `texts` under an id. */
export declare function nestGrammars<T>(
  program: T,
  language: string,
  translator: {
    parseFragment(source: string, from: string): { program: unknown };
    detectLanguage(
      source: string,
      options?: { limit?: number }
    ): { id: string; natural: boolean; reads: boolean }[];
  }
): T;
/** The plain meta program of a nested one. */
export declare function unnest<T>(program: T): T;
/** A meta program without the parts that do not change what it does:
 * comments, imports, blank lines, types and mutability. */
export declare function effectOf<T>(program: T): T;
/** Whether a translation does what its source does: both read into the same
 * meta program once the parts without an effect are left out. The
 * translation is written by the translator unless one is given. */
export declare function checkEquivalence(
  translator: {
    translate(
      source: string,
      from: string,
      to: string,
      options?: object
    ): string;
    toMeta(source: string, from: string): unknown;
  },
  request: {
    source: string;
    from: string;
    to: string;
    translation?: string;
    options?: object;
  }
): {
  equivalent: boolean;
  translation: string;
  metaLines: number;
  differences: { line: number; source: string; target: string }[];
};
/** The deep reading of a text as prose: sentences, words and meanings. */
export declare function readProse(
  text: string,
  options?: { language?: string; readCode?: (code: string) => unknown }
): unknown;
/** A natural language standard of one's own (Links Notation for
 * registerNaturalLanguage) from the changed entries of a vocabulary. */
export declare function naturalStandardSource(options: {
  id: string;
  label?: string;
  base: string;
  entries: readonly { concept: string; words: string[] }[];
}): string;
