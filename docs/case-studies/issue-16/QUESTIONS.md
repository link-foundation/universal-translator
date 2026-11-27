# Questions and runtime documentation

Work in [PR 17](https://github.com/link-foundation/universal-translator/pull/17)
addresses the introspection examples in issue 16. The broader question and query
criterion remains open while SQL/LINQ and other target families are implemented.

## Representation and composition

`Question` is an expression with an `aspect` (`type`, `documentation`, `source`,
`details`) and an ordinary expression as its `subject`. An `Evaluate` statement
asks the question; other expression positions consume its answer. For example,
Python `print(meaning.__doc__)` asks for documentation inside an output statement.
The controlled natural grammars have distinct question and answer phrases. The
same recursive expression reader handles their subject slots; these are not
whole-program examples or name-specific substitutions.

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
