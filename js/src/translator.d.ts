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

export interface GrammarTranslatorOptions {
  parse?: (source: string, syntax: Record<string, unknown>) => unknown;
  understanding?: Rule[];
  infer?: (meta: unknown) => unknown;
  meaning?: Rule[];
  context?: Rule[];
  layers?: Rule[][];
  emit?: (meta: unknown, to: string) => string;
  emitMachineCode?: (meta: unknown, to: string) => string;
  lift?: (machine: unknown) => unknown;
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
    versions?: { version: string; label: string; default: boolean }[];
  }[];
  /** Controlled natural languages and profiles (base is the language a profile extends). */
  naturalLanguages(): { id: string; label: string; base?: string }[];
  toMeta(source: string, from: string): unknown;
  /** The same translator with other data rules. */
  withRules(rules: TranslationRules | string): GrammarTranslator;
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
  /** Read a complete fragment: a whole program, function definitions or
   * statements. */
  parseFragment(source: string, from: string): Fragment;
  /** Translate a complete fragment into the same kind of fragment. */
  translateFragment(
    source: string,
    from: string,
    to: string,
    options?: TranslationOptions
  ): string;
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

export declare function translateFragment(
  source: string,
  from: string,
  to: string,
  options?: TranslationOptions
): string;
