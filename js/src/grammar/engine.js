// The same grammar IR and feature executor as meta-language 1.0.0 in Rust.
export { Grammar } from '../../../vendor/meta-language-grammar/src/grammar.js';
export {
  GRAMMAR_IMPORT_FORMATS as grammarImportFormats,
  GRAMMAR_EXPORT_FORMATS as grammarExportFormats,
  grammarImporter,
  grammarEmitter,
  parseNativeGrammar,
  renderNativeGrammar,
} from '../../../vendor/meta-language-grammar/src/grammar-interchange.js';
export {
  createGrammarParser,
  GrammarParseError,
  GrammarRuntimeError,
  renderSyntaxTree,
} from '../../../vendor/meta-language-grammar/src/grammar-runtime.js';
export {
  mergeGrammars,
  renameGrammarRule,
} from '../../../vendor/meta-language-grammar/src/grammar-merge.js';
export { validateGrammar } from '../../../vendor/meta-language-grammar/src/grammar-validate.js';
