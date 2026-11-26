export interface ConcreteLeaf {
  kind: 'Token' | 'Trivia';
  type: string;
  start: number;
  end: number;
  text: string;
}

export interface ConcreteSyntax {
  kind: 'ConcreteSyntax';
  language: string;
  unit: 'utf8';
  start: number;
  end: number;
  children: ConcreteLeaf[];
  productions: {
    kind: 'Production';
    rule: string;
    concept: string;
    start: number;
    end: number;
  }[];
}

export declare function reconstructConcrete(syntax: ConcreteSyntax): string;
