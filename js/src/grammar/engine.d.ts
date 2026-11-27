/** Byte ranges in the original UTF-8 source. */
export interface GrammarTree {
  type: 'node' | 'embed' | 'token' | 'error' | 'missing';
  start: number;
  end: number;
  kind?: string | null;
  language?: string;
  children?: GrammarTree[];
  root?: GrammarTree;
  text?: string;
  trivia?: boolean;
  reason?: string;
  field?: string;
  attributes?: Record<string, unknown>;
  literal?: boolean;
}

export interface GrammarRule {
  name: string;
  kind: string;
  expression: { kind: string; [field: string]: unknown };
  [field: string]: unknown;
}

export declare class Grammar {
  constructor(
    start: string | null,
    rules?: Iterable<[string, Omit<GrammarRule, 'name'>]>,
    sourceFormat?: string | null,
    declarations?: Record<string, unknown> | null
  );
  start: string | null;
  sourceFormat: string | null;
  declarations: Record<string, unknown>;
  rules: Map<string, GrammarRule>;
  kinds: { name: string; sourceNames?: { source: string; name: string }[] }[];
  rule(name: string): GrammarRule | undefined;
  ruleNames(): string[];
  startRule(): GrammarRule | undefined;
  referencedNonterminals(): string[];
  undefinedNonterminals(allowed?: string[]): string[];
  externalTokens(): string[];
  normalized(): Record<string, unknown>;
}

export interface GrammarRejection {
  reason: string;
  offset?: number;
  line?: number;
  column?: number;
  expected?: string[];
  limit?: number;
}

export interface GrammarOutcome {
  ok: boolean;
  tree: GrammarTree | null;
  rejection: GrammarRejection | null;
  ambiguities: unknown[];
}

export interface GrammarParseOptions {
  maxDepth?: number;
  stepLimit?: number;
  memoLimit?: number;
  memoryLimit?: number;
  maxRepairs?: number;
  startRule?: string;
  resolveGrammar?: (id: string) => Grammar | null | undefined;
  [option: string]: unknown;
}

export declare class GrammarParseError extends Error {
  constructor(rejection: GrammarRejection);
  rejection: GrammarRejection;
  reason: string;
  offset: number | null;
  line: number | null;
  column: number | null;
  expected: string[];
}
export declare class GrammarRuntimeError extends Error {}
export declare function createGrammarParser(
  grammar: Grammar,
  options?: GrammarParseOptions
): {
  parseTree(
    source: string | Uint8Array,
    options?: GrammarParseOptions
  ): GrammarOutcome;
  parse(
    source: string | Uint8Array,
    options?: GrammarParseOptions
  ): GrammarTree;
};
export declare function renderSyntaxTree(tree: GrammarTree): string;

export declare const grammarImportFormats: readonly string[];
export declare const grammarExportFormats: readonly string[];
export declare function grammarImporter(
  format: string
): ((source: string) => Grammar) | null;
export declare function grammarEmitter(format: string):
  | ((grammar: Grammar) => {
      source: string;
      report: { lossy: string[]; [field: string]: unknown };
    })
  | null;
export declare function parseNativeGrammar(source: string): Grammar;
export declare function renderNativeGrammar(grammar: Grammar): string;
export interface GrammarMergeGroup {
  key: string;
  language: string;
  edition: string;
  sources: string[];
  grammar: Grammar;
  identities: Record<string, string>;
  fingerprint: string;
  [field: string]: unknown;
}
export interface GrammarMergeResult {
  status: 'complete' | 'incomplete';
  groups: GrammarMergeGroup[];
  reused: string[];
  recomputed: string[];
  alternatives: unknown[];
  failures: unknown[];
}
export interface GrammarMergeOptions {
  previous?: GrammarMergeResult;
  samples?: Record<string, string[]>;
  requiredEquivalences?: [string, string][];
  reconcile?: boolean;
  [option: string]: unknown;
}
export declare function mergeGrammars(
  sources: {
    id: string;
    language: string;
    edition?: string;
    precedence?: number;
    grammar: Grammar;
  }[],
  options?: GrammarMergeOptions
): GrammarMergeResult;
export declare function renameGrammarRule(
  grammar: Grammar,
  from: string,
  to: string,
  options?: Record<string, unknown>
): { grammar: Grammar; [field: string]: unknown };
export declare function validateGrammar(grammar: Grammar): {
  kind: string;
  severity: 'error' | 'warning';
  rule: string;
  message: string;
  [detail: string]: unknown;
}[];
