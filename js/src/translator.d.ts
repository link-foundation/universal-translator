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
