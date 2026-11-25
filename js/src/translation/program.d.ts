import type { SourceDocument, SyntaxNetworkClass } from './source-document.js';

export type CompileProgram = (
  source: string,
  from: string,
  to: string
) => {
  code: string;
  diagnostic: { message: string } | null;
  semantics: object | null;
};

export function createProgramTranslator(grammarEngine: {
  LinkNetwork: SyntaxNetworkClass;
  translateProgram: CompileProgram;
}): {
  translate(document: SourceDocument, target: string): string;
};
