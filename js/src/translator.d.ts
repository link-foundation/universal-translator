export type TranslationMode = 'context-dependent' | 'literal' | 'same-effect';

export interface TranslationOptions {
  mode?: TranslationMode;
  /** Print through the operations of `common-library/` instead of the
   * target's own output statements. */
  commonLibrary?: boolean;
}

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

export interface GrammarTranslator {
  languages(): { id: string; label: string }[];
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
