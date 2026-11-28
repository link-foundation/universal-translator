// @deno-types="../translation/concrete-syntax.d.ts"
import type { ConcreteSyntax } from '../translation/concrete-syntax.js';
// @deno-types="./engine.d.ts"
import type {
  Grammar,
  GrammarMergeOptions,
  GrammarMergeResult,
  GrammarOutcome,
  GrammarParseOptions,
  GrammarTree,
} from './engine.js';

export interface GrammarDescriptor {
  id: string;
  language: string;
  format: string;
  source: string;
  edition?: string;
  precedence?: number;
  revision?: string;
  url?: string;
}
export interface ImportedGrammar extends GrammarDescriptor {
  edition: string;
  precedence: number;
  importedSource: string;
  grammar: Grammar;
}
export interface GrammarProvenance {
  id: string;
  revision?: string;
  url?: string;
}
export interface GrammarSelection {
  language?: string;
  edition?: string;
  sourceId?: string;
  limits?: GrammarParseOptions;
}
export interface GrammarConcreteSyntax extends ConcreteSyntax {
  grammar: GrammarProvenance[];
  tree: GrammarTree | null;
}
export interface GrammarReading extends GrammarOutcome {
  syntax: GrammarConcreteSyntax;
}
export type GrammarTransform<Value, Context> = (
  value: Value,
  context: Context
) => Value;
type Hooks<Value, Context> =
  | GrammarTransform<Value, Context>
  | GrammarTransform<Value, Context>[];
export interface GrammarContext extends GrammarSelection {
  provenance?: GrammarProvenance[];
  source?: string;
  format?: string;
}
export interface GrammarHooks {
  beforeImport?: Hooks<string, GrammarDescriptor>;
  afterImport?: Hooks<Grammar, GrammarDescriptor>;
  beforeCompile?: Hooks<Grammar, GrammarContext>;
  afterParse?: Hooks<GrammarOutcome, GrammarContext>;
  beforeExport?: Hooks<Grammar, GrammarContext>;
  afterExport?: Hooks<string, GrammarContext>;
  trace?: (stage: string, context: GrammarDescriptor | GrammarContext) => void;
}
export interface GrammarSourceProgram {
  kind: 'SourceProgram';
  items: unknown[];
  [field: string]: unknown;
}
export interface GrammarReaderContext {
  source: string;
  syntax: GrammarConcreteSyntax;
  /** The range is measured in UTF-8 bytes, as in GrammarTree. */
  node(
    kind: string,
    fields: Record<string, unknown>,
    range: { start: number; end: number }
  ): Record<string, unknown>;
}
export type GrammarReader = (
  tree: GrammarTree,
  context: GrammarReaderContext
) => GrammarSourceProgram;
type ParseStage = (source: string, syntax: Record<string, unknown>) => unknown;
export interface GrammarWorkspace {
  import(descriptor: GrammarDescriptor): Readonly<ImportedGrammar>;
  update(
    id: string,
    patch: Partial<GrammarDescriptor>
  ): Readonly<ImportedGrammar>;
  refresh(
    id: string,
    load: (
      descriptor: ImportedGrammar
    ) =>
      | string
      | Partial<GrammarDescriptor>
      | Promise<string | Partial<GrammarDescriptor>>
  ): Promise<Readonly<ImportedGrammar>>;
  remove(id: string): void;
  sources(): Readonly<ImportedGrammar>[];
  merge(options?: GrammarMergeOptions): GrammarMergeResult;
  grammar(options: GrammarSelection): Grammar;
  parse(source: string, options: GrammarSelection): GrammarReading;
  export(format: string, options: GrammarSelection): string;
  read(
    source: string,
    options: GrammarSelection,
    lower: GrammarReader
  ): GrammarSourceProgram & { language: string; syntax: GrammarConcreteSyntax };
  decorateParser(
    readers: Record<string, GrammarReader>,
    options?: GrammarSelection
  ): (next: ParseStage) => ParseStage;
}
/** Defaults bound parser depth, steps, memo entries and memory units. */
export declare function createGrammarWorkspace(
  hooks?: GrammarHooks
): GrammarWorkspace;
