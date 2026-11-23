import type { LinkId, LinkNetwork } from 'meta-language';

export type Effect =
  | { task: 'hello'; message: string }
  | { task: 'greatest-common-divisor'; left: number; right: number }
  | { task: 'fizz-buzz'; limit: number };

export type LanguageKind =
  | 'programming'
  | 'instruction'
  | 'natural-language'
  | 'meta-language';

export interface LanguageForm {
  task: Effect['task'];
  name: string;
  source: string[];
  fixed?: Record<string, string | number>;
  requires?: string[];
  output?: string;
}

export interface LanguageProfile {
  id: string;
  label: string;
  kind?: LanguageKind;
  comment: string;
  commentEnd?: string;
  header?: number;
  call: string;
  output: string;
  forms: LanguageForm[];
}

export interface Comment {
  text: string;
  placement: 'leading' | 'body';
  line: number;
}

export interface Interpretation {
  effect: Effect;
  form: string;
  comments: Comment[];
  output: string;
  requires: string[];
}

export interface Document {
  language: string;
  network: LinkNetwork;
  interpretation?: Interpretation;
}

export interface Projection {
  effect: Effect;
  comments: Comment[];
  form: string;
}

export interface Expression extends Projection {
  language: string;
  network: LinkNetwork;
  id: LinkId;
}

export interface Translation {
  code: string;
  document: Document;
  expression: Expression;
}

export type Mode = 'context-dependent' | 'literal' | 'same-effect';
export interface Options {
  mode?: Mode;
  form?: string;
}
export interface Adapter {
  parse(source: string): Interpretation | undefined;
  emit(projection: Projection): string;
}
export interface Context {
  from: string;
  to: string;
  mode: Mode;
  document: Document;
}
export interface TranslatorConfig {
  profiles?: LanguageProfile[];
  decorateAdapter?: (language: string, adapter: Adapter) => Adapter;
  layers?: Array<
    Array<(projection: Projection, context: Context) => Projection>
  >;
  verify?: (
    expected: Effect,
    parsed: Effect | undefined,
    expression: Expression
  ) => boolean;
}
export interface Translator {
  listLanguages(): Array<{
    id: string;
    label: string;
    kind: LanguageKind;
    forms: Array<Pick<LanguageForm, 'task' | 'name'>>;
  }>;
  parse(source: string, language: string): Document;
  restore(document: Document): string;
  transform(document: Document, target: string, options?: Options): Expression;
  expression(
    language: string,
    effect: Effect,
    options?: Partial<Pick<Projection, 'comments' | 'form'>>
  ): Expression;
  materialize(expression: Expression): string;
  translate(
    source: string,
    from: string,
    to: string,
    options?: Options
  ): string;
  translateDetailed(
    source: string,
    from: string,
    to: string,
    options?: Options
  ): Translation;
}

export declare function createTranslator(config?: TranslatorConfig): Translator;
export declare const translate: Translator['translate'];

export declare function languageProfiles(): LanguageProfile[];

export interface Observation {
  count: number;
  total: number;
}
export interface Candidate {
  id: string;
  target: string;
  type: string[];
  back: string[];
  sourceEvidence?: Observation | null;
  targetEvidence?: Observation | null;
  context?: number | null;
}
export interface RankedCandidate extends Candidate {
  roundTrip: boolean;
  confidence: [number, number];
}
export declare function rankInterpretations(
  source: string,
  candidates: Candidate[],
  requiredType?: string[]
): { candidates: RankedCandidate[]; preferred: RankedCandidate[] };

export function readEffects(source: string): Effect[];
export function writeEffect(effect: Effect): string;
