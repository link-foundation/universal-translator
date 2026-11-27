# Selection queries and natural questions

This work in [PR 17](https://github.com/link-foundation/universal-translator/pull/17)
implements a compositional selection subset of requirement 16.12. The full query
and inherited language-coverage requirements remain open.

## Shared meaning

`Query` holds ordinary expressions for `source`, `condition` and `projection`,
a scoped range `variable`, and an `eager` evaluation flag. It can appear as an
expression in a binding, return or another query. `Evaluate(Query)` asks for the
result. This separates selection questions from the earlier introspection
`Question` expression; SQL does not implement Python reflection.

Readers recognize SQL `SELECT … FROM … [AS …] [WHERE …]`, C# LINQ
`from … in … [where …] select …`, Python list/generator comprehensions, and
single-parameter JavaScript/TypeScript `filter`/`map` chains. All 71 controlled
natural grammars compose their own expression slots into question and answer
forms. The 30 base languages have native phrases; restricted profiles derive
clauses from their own allowed loop/condition/result vocabulary. Minimal profiles
use quoted technical operation tags. No vocabulary limits are expanded.

SQL is listed as a query target separately from the 33 imperative grammars and
seven machine dialects. Its reader preserves quoted identifier case and SQL
string escaping; its writer rejects imperative programs and common-library
mode. The public capability flag prevents old algorithm-coverage tests from
claiming that a query language implements imperative entry points.

## Evaluation, types and scope

C# query expressions enumerate lazily. `ToArray()` materializes their results;
this is described by Microsoft's [query execution documentation](https://learn.microsoft.com/en-us/dotnet/csharp/linq/get-started/introduction-to-linq-queries).
Python list comprehensions are eager while generator expressions defer their
bodies, as documented in the [Python expression reference](https://docs.python.org/3/reference/expressions.html#generator-expressions).
The native example changes a source row between construction and enumeration
to make this distinction observable. SQL output rejects a deferred iterator,
and JavaScript output rejects deferred queries until it has a lazy writer.

Eager filter/map chains with function calls remain nested query expressions:
all filtering effects finish before projection effects start. Combining
side-effect-free predicates and projections is supported for ordinary data
records. Arbitrary getters, custom iterators and overloaded operations still
need additional semantic modeling.

Collection types retain the projected element and evaluation strategy as
`array<element>` or `sequence<element>`. C# emits inferred query bindings with
`var`, typed array/enumerable function returns, and expression-position array
constructors. A local range variable receives the source element type, rather
than inheriting an unrelated outer binding's type. Free-variable rewrites stop
at nested binders while still traversing their source expressions. C# receives
fresh range names where its local-name rules require them.

## Reproduction and evidence

- `experiments/issue-16-queries.mjs` exercises four source grammars against four
  targets and records explicit unsupported evaluation strategies.
- `experiments/issue-16-query-typing.mjs` records binding, function-return and
  nested-scope translations.
- `js/tests/queries.test.js` checks registration/detection, formal round trips,
  all natural grammars, vocabulary constraints, eager/deferred strategies,
  quoted SQL names, collection types, scope, filter/map side effects and native
  SQLite/Python/Node agreement.
- `rust/tests/queries.rs` covers the matching shared representation, formal and
  natural round trips, strategy rejection, collection types and scopes.
- `examples/queries/verify-native.mjs` compiles the generated C# methods and
  bindings and compares finite results across four native runtimes. The existing
  native CI job includes it with a finite step budget.
- Focused logs: `logs/queries-js-regressions.txt`, `logs/queries-rust-regressions.txt`,
  `logs/queries-final-js.txt`, `logs/queries-final-rust.txt`,
  `logs/queries-native.txt`, `logs/queries-clippy.txt`, `logs/queries-lint.txt`,
  `logs/queries-natural-goldens.txt` and `logs/queries-requirements.txt`.

Primary sources are compressed and checksummed in
`data/prior-art/questions/manifest.json`. The historical requirements gate's
old completion labels are not acceptance evidence for the broader inventory.

## SQL negation and Python comparison grouping

The shared imperative precedence table treated `NOT age = 18` as
`(NOT age) = 18`. SQL's prefix NOT has lower precedence than comparisons and
higher precedence than AND, as specified by the
[SQLite expression reference](https://www.sqlite.org/lang_expr.html#operators_and_parse_affecting_attributes).
The SQL readers now use a dialect-specific precedence parser. Unary minus,
comparison/equality levels, mixed-case keywords and explicit groups compose
with the existing selection reader; both SQL writers group negation explicitly.

Native execution also exposed two Python emission faults. A nested boolean
comparison must be parenthesized so Python does not interpret it as a chained
comparison, and a negated comparison used as another comparison's operand
needs grouping. Both shared Python writers now retain those boundaries. The
[Python expression reference](https://docs.python.org/3/reference/expressions.html#comparisons)
defines the chaining behavior. These changes preserve operation trees; they do
not infer SQL NULL behavior from host-language booleans.

`examples/queries/negation.json` contains 23 finite predicates over nine integer
rows. `node experiments/issue-16-sql-negation.mjs --before` substitutes the old
SQL reader at `175f50f`: 16 cases disagree with native SQLite. The independent
`--before-writer` mode substitutes only the old shared writer: four cases
produce a different Python result or invalid Python syntax. The current path
has zero failures. `examples/queries/verify-native.mjs` executes all 23 predicates
in SQLite, Python, Node and generated C#; all results agree. The verifier's
additional queries use an independent range name to avoid collisions with its
separately generated shadowing example.

Matching JavaScript/Rust tests check the NOT operation tree and all predicates
through SQL, Python, JavaScript, TypeScript, C#, English and Russian. Focused
checks pass: 17 JavaScript query/number tests, eight Rust query tests, ESLint,
Clippy and the native verifier. Logs are `logs/sql-negation-{before,before-writer,after}.json`,
`logs/sql-negation-{js,rust,native,lint,clippy}.txt`. The primary reference is
checksummed in the questions manifest. NULL propagation and general SQL
semantics remain unfinished under requirement 16.12.

## Remaining work

The supported SQL subset assumes non-null records; its current binary
comparisons do not implement SQL three-valued logic. Explicit NULL expressions
are rejected. SQLite's [SELECT documentation](https://www.sqlite.org/lang_select.html)
provides the basis for extending filtering, grouping and result semantics.
Joins, grouping, aggregation, ordering, multiple projections, complete SQL
syntax, general object/record types, other target families, arbitrary natural
questions and complete natural-language agreement remain unfinished. These
limits keep requirement 16.12 open even when its focused regressions pass.
