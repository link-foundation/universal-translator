// Parsing and library contracts retain a separate lossless concrete record.
import { tokenize } from './lexer.js';
import { objpakSource, objpakConcrete } from './objpak-reader.js';
import {
  concreteParser,
  concreteSyntax,
} from '../translation/concrete-syntax.js';
import { registerOrigins } from '../translation/source-origins.js';

export function parseSource(source, syntax, LanguageParser) {
  const library = objpakSource(source, syntax.id, syntax);
  const tokens = tokenize(library.source, syntax);
  const { parser, locations } = concreteParser(
    new LanguageParser(tokens, syntax),
    source
  );
  const tree = parser.program();
  if (library.bindings.length) {
    tree.objpakBindings = library.bindings;
  }
  registerOrigins(tree, locations, source);
  const concreteTokens = tokens.filter(
    ({ rawSpan }) =>
      !library.definitions.some(
        ([start, end]) => rawSpan && rawSpan[0] >= start && rawSpan[1] <= end
      )
  );
  return {
    ...tree,
    syntax: objpakConcrete(
      concreteSyntax(source, syntax.id, concreteTokens, tree, locations),
      source,
      library.definitions
    ),
  };
}
