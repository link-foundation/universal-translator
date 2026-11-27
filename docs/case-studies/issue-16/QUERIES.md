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
checksummed in the questions manifest. Nullable numeric rows now have their own contracts, described below; general SQL
semantics remain unfinished under requirement 16.12.

## Nullable SQL values

The earlier shared binary nodes conflated SQL NULL with host values. Rejecting
an explicit NULL literal did not protect a query whose source column contained
NULL: Python could raise on comparison and JavaScript could coerce null to zero.
SQL readers now retain `Null`, `SqlBinary`, `SqlUnary` and `SqlTruth` concepts.
SQL operators propagate NULL; AND/OR use their complete three-valued tables;
NOT preserves unknown. IS/IS NOT are null-safe, and IS TRUE/FALSE and their
negations test truth rather than compare with the integer one. WHERE retains
only true rows, including when the predicate is a nullable number rather than
an explicit comparison. These are the [SQLite expression rules](https://www.sqlite.org/lang_expr.html).

Python, JavaScript, TypeScript and C# writers share independently executable
helper definitions in `data/runtime/sql-values.json`; both translator engines
consume the same source. The helpers retain numeric 0/1 comparison results,
integer division truncation, real-literal division, signed remainder and SQLite
NULL results for zero divisors. SQL value nodes infer a nullable object result,
while the WHERE truth test yields a host boolean. Ordinary host binary nodes
retain their existing meaning. Real literal spellings inside SQL helper calls
survive JavaScript/TypeScript rereading, including integer-valued real operands.

Readers verify native helper tokens before assigning a contract to calls. They
retain every helper byte as a separate `sqlValueLibrary` concrete production.
Fresh class names avoid user bindings; reassignment, escaping, shadowing and
unknown helper calls are rejected. JavaScript and TypeScript return-line
boundaries, including Unicode line separators, participate in verification.
Rust masks all embedded definitions together using original source ranges and
lexer character positions; multiple independent libraries and Unicode
whitespace cannot shift later definitions or source locations. Verified pure
filter/map clauses merge after helper recognition; arbitrary calls keep their
separate evaluation stages.

`examples/queries/nullable.json` defines 81 finite cases over nine nullable
integer rows. It includes all nine input pairs for both AND and OR, nullable
NOT/comparisons/arithmetic, IS predicates, WHERE truth, zero divisors and
integer/real literal division. The prior reader at `c739a05` fails 65 cases:

```sh
node experiments/issue-16-sql-values.mjs --before
node experiments/issue-16-sql-values.mjs
node examples/queries/verify-native.mjs
```

The corrected experiment has zero failures across native SQLite, generated
Python/Node, and SQL restored after JavaScript rereading. The native example
also compiles generated C# and agrees on every case. Both engines round-trip
all cases through SQL and the four host grammars, plus a composite query through
all 71 natural grammars. Small independent forms satisfy each restricted
vocabulary/length limit. Complex forms still need the broader natural-grammar
work in the inventory.

Focused checks pass: 36 JavaScript tests (query, NULL, helper, Objpak and chunk
contracts), 32 Rust tests, ESLint, Clippy and the native verifier. Evidence is
`logs/sql-values-{before,after}.json`, `logs/sql-values-{js,rust,native,lint,clippy}.txt`.
The earlier negation reproducer retains its 16 old-reader failures and four
independent old-writer failures with the former non-nullable meta contract;
`logs/sql-values-negation-{before,before-writer,after}.json` preserves that rerun.
The SQLite primary reference is already archived and checksummed in the
questions manifest.

## Remaining work

The verified nullable subset uses complete numeric/NULL input records and finite
numbers within the host runtimes' exact common range. SQL dialect selection,
schema affinity, text-to-number conversion, mixed storage classes, floating
column type tags in JavaScript, integer overflow and full text collations need
further modeling. SQLite's zero-divisor behavior is explicit here; other SQL
dialects can raise instead. A translated binding supplies the same typed values
used in the verified SQLite table. These checks do not establish full SQL NULL
semantics for arbitrary schemas or runtimes.

Joins, grouping, aggregation, ordering, multiple projections, complete SQL
syntax, general object/record types, other target families, arbitrary natural
questions and complete natural-language agreement remain unfinished. SQLite's
[SELECT documentation](https://www.sqlite.org/lang_select.html) provides the basis
for extending clause and result semantics. These limits keep requirement 16.12
open even when its focused regressions pass.

Final helper review adds ordinary JS/TS comments to token matching while
retaining significant return-line checks, including line breaks inside block
comments. This exposed a JavaScript offset error with emoji in comments inside
multiple verified definitions. Masking now preserves UTF-16
code-unit counts in both SQL and Objpak helpers; Rust masks from the original
source once using its lexer character offsets. The shared multiple-library
regression checks exact UTF-8 reconstruction and subsequent query meaning.
`logs/sql-values-utf16-before.txt` preserves the failing pre-fix check.
