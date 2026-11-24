export type TranslationMode = 'context-dependent' | 'literal' | 'same-effect';

export interface TranslationOptions {
  mode?: TranslationMode;
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
  trace?: (stage: string, tree: unknown) => void;
}

export interface GrammarTranslator {
  languages(): { id: string; label: string }[];
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
