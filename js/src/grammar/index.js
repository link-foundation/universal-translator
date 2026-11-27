// Browser-safe grammar entry: no HTTP server or command-line modules.
export * as grammarEngine from './engine.js';
export { createGrammarWorkspace } from './workspace.js';
export { reconstructConcrete } from '../translation/concrete-syntax.js';
