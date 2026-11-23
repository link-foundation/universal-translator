/**
 * Example module type definitions
 * Replace this with your actual type definitions
 */

/**
 * Adds two numbers
 * @param a - First number
 * @param b - Second number
 * @returns Sum of a and b
 */
export declare const add: (a: number, b: number) => number;

/**
 * Multiplies two numbers
 * @param a - First number
 * @param b - Second number
 * @returns Product of a and b
 */
export declare const multiply: (a: number, b: number) => number;

/**
 * Delays execution for specified milliseconds
 * @param ms - Milliseconds to wait
 * @returns Promise that resolves after the delay
 */
export declare const delay: (ms: number) => Promise<void>;

export * from './translation/translator.js';
export * as commonLibrary from './common-library.mjs';

export function readSourceDocument(notation: string): {
  language: string;
  source: string;
};
export function writeSourceDocument(language: string, source: string): string;

interface SyntaxNetwork {
  links(): Array<{
    metadata(): { linkType?: string; language?: string; span?: unknown };
  }>;
  parseGrammars(): Array<{ language: string }>;
  reconstructText(): string;
  toLino(): string;
}

export function createSourceSyntaxCodec(linkNetwork: {
  prototype: SyntaxNetwork;
  parse(source: string, language: string): SyntaxNetwork;
  fromLino(notation: string): SyntaxNetwork;
}): {
  write(language: string, source: string): string;
  read(notation: string): { language: string; source: string };
};
