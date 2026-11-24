export interface SourceDocument {
  language: string;
  source: string;
}

export function readSourceDocument(notation: string): SourceDocument;
export function writeSourceDocument(language: string, source: string): string;

export interface SyntaxNetwork {
  links(): Array<{
    metadata(): { linkType?: string; language?: string; span?: unknown };
  }>;
  parseGrammars(): Array<{ language: string }>;
  reconstructText(): string;
  toLino(): string;
  verifyFullMatch(): { isClean(): boolean };
}

export interface SyntaxNetworkClass<
  Network extends SyntaxNetwork = SyntaxNetwork,
> {
  prototype: Network;
  parse(source: string, language: string): Network;
  fromLino(notation: string): Network;
}

export function createSourceSyntaxCodec<Network extends SyntaxNetwork>(
  linkNetwork: SyntaxNetworkClass<Network>
): {
  parse(language: string, source: string): Network;
  write(language: string, source: string): string;
  read(notation: string): SourceDocument;
};
