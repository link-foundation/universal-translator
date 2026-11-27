import type { ConcreteSyntax } from './translation/concrete-syntax.js';

export type TranslationMode = 'context-dependent' | 'literal' | 'same-effect';

export interface TranslationOptions {
  mode?: TranslationMode;
  /** Print through the operations of `common-library/` instead of the
   * target's own output statements. */
  commonLibrary?: boolean;
  /** Natural language to translate the comments to. When `from` and `to`
   * are the same programming language only the comments change, in place. */
  commentLanguage?: string;
  /** Natural language of the comments (detected when not given). */
  commentFrom?: string;
  /** Natural language to translate the declared names (functions,
   * parameters, variables) to. When `from` and `to` are the same
   * programming language only the names change, in place. Languages that
   * take ASCII names only get a transliteration. */
  identifierLanguage?: string;
  /** Natural language of the declared names (detected when not given). */
  identifierFrom?: string;
  /** Translator for one comment text (and the phrase a declared name
   * makes); a dictionary is the default. */
  translateComment?: CommentTranslator;
  /** Partial translation between programming languages keeps the spaces,
   * blank lines, indentation step and line ends of the source ('source',
   * the default) or the layout its emitter writes ('target'); both return
   * a `lineMap` of [source line, target line] pairs (0-based). */
  layout?: 'source' | 'target';
  /** Where the brace that opens a block goes: on the line of its statement
   * or on a line of its own (not in Go). Lays the target out anew. */
  braces?: 'same-line' | 'next-line';
  /** How deep each block is indented: a number of spaces (1 to 16) or
   * 'tab'. Lays the target out anew. */
  indent?: number | string;
}

export type CommentTranslator = (
  text: string,
  languages: { from: string; to: string }
) => string;

export type Rule = (tree: unknown, context: Record<string, unknown>) => unknown;

/** A text rule: `find` is plain text unless `regex` is true; `language`
 * limits it to one source (source rules) or target (output rules). */
export interface TextRule {
  find: string;
  replace?: string;
  regex?: boolean;
  language?: string;
}

/** Rules given as data, one list per stage of the pipeline. */
export interface TranslationRules {
  source?: TextRule[];
  /** More wordings a natural language reads: language -> key -> templates. */
  templates?: Record<string, Record<string, string | string[]>>;
  names?: { find: string; replace: string }[];
  output?: TextRule[];
}

/** The replaceable stages of the pipeline, each a function. */
export interface Stages {
  parse: (source: string, syntax: Record<string, unknown>) => unknown;
  infer: (meta: unknown) => unknown;
  lift: (machine: unknown) => unknown;
  readMachine: (source: string, from: string) => unknown;
  readNatural: (
    source: string,
    from: string,
    language?: Record<string, unknown>
  ) => unknown;
  emit: (meta: unknown, to: string) => string;
  emitMachineCode: (meta: unknown, to: string) => string;
  writeNatural: (meta: unknown, to: string) => string;
}

export type StageName = keyof Stages;

/** A decorator receives the inner implementation of a stage and returns the
 * wrapped one. */
export type Decorator<Stage extends StageName> = (
  inner: Stages[Stage]
) => Stages[Stage];

/** Decorators by stage: one decorator or a list. A list is composed in
 * order: the first is innermost and the last sees the input first and the
 * output last. */
export type Decorators = {
  [Stage in StageName]?: Decorator<Stage> | Decorator<Stage>[];
};

export interface GrammarTranslatorOptions extends Partial<Stages> {
  understanding?: Rule[];
  meaning?: Rule[];
  context?: Rule[];
  layers?: Rule[][];
  /** Wrappers around the stages (also replaced ones). */
  decorate?: Decorators;
  trace?: (stage: string, tree: unknown) => void;
  /** Rules as indented Links Notation text (see readRules) or an object. */
  rules?: TranslationRules | string;
}

/** What a fragment holds: a whole program, function definitions only, or
 * statements only. */
export type FragmentKind = 'program' | 'functions' | 'statements';

export interface Fragment {
  kind: FragmentKind;
  /** The meta program of the fragment. */
  program: unknown;
}

export interface PartialError {
  line: number;
  endLine: number;
  message: string;
  source: string;
}

export interface PartialReading {
  complete: boolean;
  syntax: ConcreteSyntax;
  parts: (Omit<PartialError, 'message'> & {
    start: number;
    end: number;
    status: 'read' | 'failed';
    kind?: FragmentKind;
    message?: string;
  })[];
  lines: number;
  readLines: number;
  coverage: number;
  errors: PartialError[];
}

export interface PartialTranslation {
  text: string;
  /** Pairs of zero-based source and target lines with shared ownership. */
  lineMap: [number, number][];
  /** Semantic regions in the original source and final output. Ranges are
   * half-open UTF-8 byte offsets; a region can have several counterparts. */
  regionMap: TranslationRegion[];
  complete: boolean;
  errors: PartialError[];
  /** Non-blank source lines. */
  lines: number;
  /** Source lines successfully written, including freely translated prose.
   * Parts rejected by the target writer are excluded. */
  readLines: number;
  /** The share successfully translated; empty input has full coverage. */
  coverage: number;
  prose: { line: number; endLine: number }[];
}

export interface ByteRange {
  start: number;
  end: number;
}

export interface TranslationRegion {
  source: ByteRange;
  target: ByteRange;
}

export interface GrammarTranslator {
  /**
   * Programming languages and machine targets; `versions` lists the versions
   * a target may name (python@2), and `machine` marks assembly dialects and
   * intermediate languages (nasm, gas, arm64, cil, jvm, llvm, wat).
   */
  languages(): {
    id: string;
    label: string;
    machine?: boolean;
    /** A relational query target, with separate imperative-language coverage. */
    query?: boolean;
    versions?: { version: string; label: string; default: boolean }[];
  }[];
  /** Controlled natural languages and profiles (base is the language a profile extends). */
  naturalLanguages(): { id: string; label: string; base?: string }[];
  toMeta(source: string, from: string): unknown;
  /** Read the supported WebAssembly version 1 binary instructions. */
  toMetaWasm(source: Uint8Array): unknown;
  /** The same translator with other data rules. */
  withRules(rules: TranslationRules | string): GrammarTranslator;
  /** The same translator with a decorator around one stage; it wraps the
   * decorators the translator already has. */
  decorate<Stage extends StageName>(
    stage: Stage,
    decorator: Decorator<Stage>
  ): GrammarTranslator;
  /** The same translator with decorators around several stages. */
  decorate(decorators: Decorators): GrammarTranslator;
  fromMeta(
    meta: unknown,
    to: string,
    options?: TranslationOptions & { from?: string }
  ): string;
  translate(
    source: string,
    from: string,
    to: string,
    options?: TranslationOptions
  ): string;
  translateWasm(
    source: Uint8Array,
    to: string,
    options?: TranslationOptions
  ): string;
  /** Read a complete fragment: a whole program, function definitions or
   * statements. */
  parseFragment(source: string, from: string): Fragment;
  /** Read accepted fragments while retaining every original source byte. */
  parsePartial(source: string, from: string): PartialReading;
  /** Translate accepted parts and mark failures with their source and reason. */
  translatePartial(
    source: string,
    from: string,
    to: string,
    options?: TranslationOptions & { fragment?: boolean }
  ): PartialTranslation;
  /** Translate a complete fragment into the same kind of fragment. */
  translateFragment(
    source: string,
    from: string,
    to: string,
    options?: TranslationOptions
  ): string;
  /** The candidate translations of a text, the most probable first (the
   * first is the default translation). */
  translateCandidates(
    source: string,
    from: string,
    to: string,
    options?: TranslationOptions
  ): TranslationCandidate[];
}

/** A candidate translation and its scores, truth values in [0, 1]:
 * probability = frequency x roundTrip x coverage. */
export interface TranslationCandidate {
  text: string;
  probability: number;
  /** How often the readings chosen in its prose are meant. */
  frequency: number;
  /** How much of the meanings of its prose a reader reads back. */
  roundTrip: number;
  /** The share of the lines translated. */
  coverage: number;
}

export declare function createGrammarTranslator(
  options?: GrammarTranslatorOptions
): GrammarTranslator;

export declare function translate(
  source: string,
  from: string,
  to: string,
  options?: TranslationOptions
): string;

export declare function parseFragment(source: string, from: string): Fragment;

export declare function parsePartial(
  source: string,
  from: string
): PartialReading;

export declare function translatePartial(
  source: string,
  from: string,
  to: string,
  options?: TranslationOptions & { fragment?: boolean }
): PartialTranslation;

export declare function translateFragment(
  source: string,
  from: string,
  to: string,
  options?: TranslationOptions
): string;

export declare function translateCandidates(
  source: string,
  from: string,
  to: string,
  options?: TranslationOptions
): TranslationCandidate[];
