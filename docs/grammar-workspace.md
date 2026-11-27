# Executable grammar workspaces

`createGrammarWorkspace` imports external grammar syntax into the Meta Language
grammar IR. JavaScript and Rust use the same upstream revision and fixtures.
This API is an extension to the replaceable translation stages; the bundled
language readers continue to provide the default semantic readers.

Run the complete example with:

```sh
node examples/grammars/import-and-translate.mjs
```

It imports a small EBNF dialect, maps its productions to `SourceProgram` and
`Print`, translates through the ordinary pipeline, updates the grammar and
checks that the old and new inputs are accepted or rejected as intended.

## Import, update and select

```js
import { createGrammarWorkspace } from '@link-foundation/universal-translator/grammar';

const grammars = createGrammarWorkspace();
grammars.import({
  id: 'greeting',
  language: 'greeting',
  edition: '1',
  format: 'ebnf',
  source: 'start = "hello" ;',
  revision: 'upstream-commit-or-release',
  url: 'https://example.org/grammar',
});
const result = grammars.parse('hello', { language: 'greeting', edition: '1' });
```

The supported formats are `bnf`, `ebnf`, `abnf`, `gbnf`, `antlr`, `lark`, `pest`,
`tree-sitter-json` and `native`. The format identifiers are exposed
as `grammarEngine.grammarImportFormats` and `grammarExportFormats`. Do not run
an untrusted tree-sitter `grammar.js`; supply its generated JSON instead.
The `/grammar` package entry works in browsers without importing the package's
Node HTTP server. The same grammar exports are also available from the root.

Each source has a stable id and optional revision, URL and precedence.
`update(id, patch)` imports and validates before replacing that source. Failed
updates leave the last imported grammar usable. `refresh(id, loader)` awaits an
injected loader returning source text or a descriptor patch. Network access and
credentials remain the caller's responsibility. Imports are resolved by source
id again at parse time, so dependency updates affect their callers.

`merge()` groups sources by language and edition. It shares rules only when
their normalized definitions satisfy recursive structural bisimulation, with
stable canonical identities for unchanged groups. Similar names or equal
sample results alone do not establish equivalence. Different languages and
editions remain separate. Pass `{ sourceId: 'greeting' }` to parse with an
individual source instead of a merged group. The merge result records separate
groups, decisions, alternatives and unresolved required equivalences.

`export(format, selection)` converts the selected grammar. If the target emitter
reports semantic loss, this API rejects the conversion. For example, a named
capture has no faithful plain EBNF representation. Supply an explicit
`beforeExport` lowering transform when the application has a faithful encoding;
the workspace never silently discards the capture. Native export retains the
feature vocabulary.

## Concrete syntax and semantic readers

Every `parse` result has the executor's nested `tree` and a lossless `syntax`
record, including rejected input. Concrete leaves cover every source byte;
trivia, production views, errors and grammar provenance remain inspectable.
`reconstructConcrete(result.syntax)` reproduces the exact Unicode source,
including CRLF and whitespace. All grammar ranges are UTF-8 byte offsets.
Invalid, overlapping or out-of-parent ranges from a transform are rejected.

`read(source, selection, lower)` requires a successful parse and calls the
semantic reader. The reader must return a `SourceProgram` with an `items`
array. Its context provides `node(kind, fields, production)` to attach original
source ownership using the production's UTF-8 range. `decorateParser(readers,
selection)` installs these readers through `createTranslator({ decorate: {
parse: ... } })`, keyed by existing language ids. Other readers still delegate
to the previous parser stage. Importing a grammar establishes syntax, while the
reader establishes its operators, effects and other meaning.

The Rust API is `grammar_workspace::{GrammarSource, GrammarWorkspace,
GrammarHooks, GrammarReader, FeatureParseOptions, source_node}`. Its workspace
uses `import`, `update`, `merge`, `parse`, `export`, `read` and
`decorate_parser`. `GrammarReading` exposes the executor outcome and the common
concrete record separately. Rust strings already require valid UTF-8; JavaScript
rejects unpaired UTF-16 surrogates rather than replacing them silently.

## Transforms, limits and provenance

JavaScript supports functions or ordered function lists for `beforeImport`,
`afterImport`, `beforeCompile`, `afterParse`, `beforeExport` and `afterExport`.
Rust exposes the same ordered lists in `GrammarHooks`. Import transforms rerun
on every update. Original source and transformed imported source are retained
separately. Tracing is off by default; supply `trace` to inspect stage events.

Defaults bound nesting to 256, steps to 1,000,000, memo entries to 100,000 and
the executor's memory accounting to 200,000 units. JavaScript accepts overrides
in `selection.limits`; Rust accepts `FeatureParseOptions`. These are executor
budgets, not a claim of fixed process memory. Limit rejections retain the input
and an explicit reason in the concrete record.

The JavaScript grammar dependency closure is pinned in
`vendor/meta-language-grammar/SOURCE.json`, matching the published Rust
`meta-language = 1.0.0` crate. The only local upstream patch uses portable SHA-256
for browser merge fingerprints. Verify it with:

```sh
node scripts/update-meta-grammar.mjs --check
```

The updater accepts a full upstream commit SHA, reapplies the explicit patch
and records original and patched file digests. Review any new dependency imports
before accepting an update. This adapter does not yet import every production
of every requested programming language or supply every semantic reader. The
shared nine-format fixture and both runtime suites verify the implemented API;
the larger coverage requirements remain in the issue inventory.
