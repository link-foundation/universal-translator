# Questions and runtime documentation

Work in [PR 17](https://github.com/link-foundation/universal-translator/pull/17)
addresses the introspection examples in issue 16. The broader question and query
criterion remains open. [Selection queries](QUERIES.md) cover a SQL/LINQ subset;
other target families and broader query semantics remain unfinished.

## Representation and composition

`Question` is an expression with an `aspect` (`type`, `documentation`, `source`,
`details`) and an ordinary expression as its `subject`. An `Evaluate` statement
asks the question; other expression positions consume its answer. For example,
Python `print(meaning.__doc__)` asks for documentation inside an output statement.
The controlled natural grammars have distinct question and answer phrases. The
same recursive expression reader handles their subject slots; these are not
whole-program examples or name-specific substitutions.

The English description shares grammar terms across query scope, branching,
loops, comparisons, and question and answer forms. A named term can refer to
another named term. A production assigns the resulting phrase and its typed
slots to a semantic role. Term expansion rejects cycles, missing references,
and oversized alternatives in both engines. A typed subject slot can in turn
read another question. The tests translate `Tell me the source of the kind of
(the documentation of meaning)?` through native Python, JavaScript and
TypeScript reflection spellings, preserving all three operations on the way
back to canonical English. Other language descriptions still support the
previous format. [English grammar](../../../data/natural/english.lino)

Restricted profiles (including NSM and ASD-STE100) keep their declared
vocabularies. They compose their existing evaluation instruction with a quoted
operation tag, for example `Do “type” (meaning)?`, and use `“type” (meaning)`
as an answer expression. The tags `type`, `documentation`, `source`, `details`
and `__doc__` are technical data, not new prose words. A profile may explicitly
override these forms. Ordinary question words are contextual: introducing
`the source of ...` does not reserve the program identifier `source`.

CI at `2198d53` exposed the inherited-vocabulary error and corresponding golden
identifier drift. The new tests check both description and generated question
text against every profile's unchanged rules; the existing natural examples
have no output drift. The browser job also exposed a missing render barrier:
an active region exists for a cursor before a selection has been painted.
The subline browser assertion now waits for Monaco's selected text first.

Python readers recognize built-in `type`, the `__doc__` property, imported
`inspect.getsource` (including module/member aliases), and IPython `meaning??`.
Declared names, parameters, and conflicting imports prevent mistaking a custom
procedure for a known reflection procedure. Detailed inspection writes the
IPython `pinfo2` API and requires an entity name rather than evaluating an
arbitrary call through a string. JavaScript/TypeScript use their native function
source and prototype constructor operations, and a portable `__doc__` property.
Unsupported aspects/targets report an error rather than guessing a replacement.
Native type objects and source spellings belong to the target language.

`Function.documentation` contains runtime text, separately from comments.
Python's first plain string expression becomes this field; an f-string does not.
JavaScript definitions carry it through an immediately following property
assignment. Assignments after other statements stay in execution order. Natural
function definitions carry an explicit documentation sentence whose quoted value
can span physical lines. An orphan documentation sentence, or a non-text value,
is rejected.

## Python edition experiment

The initial native check failed: Python 3.13+ cleans indentation in docstrings,
while an earlier compiler retains it. The release notes describe that change:
[Python 3.13 other language changes](https://docs.python.org/3.13/whatsnew/3.13.html#other-language-changes).
The archived CPython `_PyCompile_CleanDoc` implementation confirms that this
operation expands tabs, strips first-line leading spaces and a common margin
from subsequent lines, and retains leading/trailing blank lines. It differs
from `inspect.cleandoc`, which removes surrounding blank lines.

Explicit `python@3.12` and `python@3.13` editions select their source semantics;
`python`/`python@3` use current Python behavior. Python 2 and 3.5 retain the older
behavior. A target definition restores `__doc__` after its body when compiler
cleaning would alter the canonical runtime value, so older documentation can
also run on a newer compiler. The native regression discovers the installed
Python minor version and selects the corresponding source edition.

## Reproduction and verification

The base grammars for all 30 natural languages declare each reflection term
once. For example, Japanese uses `{subject} の型` as the result expression and
`@answer-type @interrogative` for the complete question. Spanish places the
same reference after its introductory clause. Russian reuses the entity and
property terms while choosing a different possessive phrase for some questions.
Both grammar loaders resolve these dependencies and reject overlapping names,
cycles and excessive expansions. Typed subject slots parse nested queries,
questions and ordinary expressions recursively at runtime. Comparing the full
expanded grammar tables before and after the migration found identical phrases
for all 71 profiles. The comparison serialized the catalog’s `templates` table
in `naturalLanguageIds()` order. Both snapshots had SHA-256
`882932d01bb48faa65692f7f1ba9c6e594e4ad9fc557f72266a78a05b917d3b3`.

- `node experiments/issue-16-recursive-phrases.mjs` checks three Python
  programs. The previous readers read `type(meaning + 1)` as an ordinary
  function call in seven languages, and commas within a nested collection
  query prevented nine profiles from reading the enclosing call. The revised
  readers prefer the reflection production, and the writers group an
  argument that contains its own separator. A literal call to the user-defined
  function `نوع` uses the existing identifier escape and still executes.
  The [native transcript](logs/recursive-phrases-native.txt) records 213
  JavaScript-engine round trips and 17 Rust CLI round trips with Python output
  checks. Both test suites cover all 71 profiles for each case.
- `node experiments/issue-16-questions.mjs`: five finite original examples;
  `logs/questions-before.txt` records missing recognition and parse failures,
  and `logs/questions-after.txt` records translated questions/documentation.
- `js/tests/questions.test.js`: four aspects, nested subjects, aliases and
  shadowing, every natural grammar, multiline values, placement validation,
  Python editions, f-string distinction, assignment order and native execution.
- `rust/tests/questions.rs`: corresponding representation, natural grammar,
  documentation, edition, placement and shadowing regressions.
- `logs/questions-js.txt`, `logs/questions-rust.txt`, and
  `logs/questions-clippy.txt`: focused checks; the existing version tests and
  production chunk graph check accompany the new tests.
- `examples/questions/meaning.py`: a runnable documentation/source/type example;
  source inspection needs an actual source file rather than Python `-c`.

Primary-source downloads for Python, IPython, C# LINQ and PostgreSQL are archived
with original-byte SHA-256 checksums in `data/prior-art/questions/manifest.json`.
SQL selection queries describe sequences and predicates; they are a separate
compositional concept from reflection on an entity, even though both answer
questions.
