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
  /** Translator for one comment text; a dictionary is the default. */
  translateComment?: CommentTranslator;
}

export type CommentTranslator = (
  text: string,
  languages: { from: string; to: string }
) => string;

export type Rule = (tree: unknown, context: Record<string, unknown>) => unknown;

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
  /** Programming languages; `versions` lists the versions a target may name (python@2). */
  languages(): {
    id: string;
    label: string;
    versions?: { version: string; label: string; default: boolean }[];
  }[];
  /** Controlled natural languages and profiles (base is the language a profile extends). */
  naturalLanguages(): { id: string; label: string; base?: string }[];
  toMeta(source: string, from: string): unknown;
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
