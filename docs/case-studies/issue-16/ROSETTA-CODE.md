# Rosetta Code coverage and behavior

The remaining coverage goal requires more than 100 distinct task types with
new evidence of correct behavior. The coverage script measures how many source
lines partial parsing consumes. A source line can be consumed while its
meaning is lost, so the figures below measure parser reach.

## Identical inputs

The [Rosetta Code task list](https://rosettacode.org/wiki/Category:Solutions_by_Programming_Task)
provided the first 160 titles alphabetically. The downloaded `solutions.json`
has SHA-256
`4efb9132103eddd4a033062c685059396e4c4cb7b2d2e27c9c62f047481a87bb`.
Both runs used the same file, the first solution per language and a 140-line
limit per solution. The download command fetches current revisions and may
produce a different checksum later.

```sh
node scripts/rosetta-code.mjs download --limit 160 --cache .cache/issue-16-rosetta
node scripts/rosetta-code.mjs coverage --limit 160 --max-lines 140 \
  --cache .cache/issue-16-rosetta --out .cache/issue-16-rosetta/report
```

| Translator                                                   | Source lines consumed | Tasks fully consumed in every represented language |
| ------------------------------------------------------------ | --------------------: | -------------------------------------------------: |
| `16f5217`, before the recovered arithmetic work              |      45,453 / 136,208 |                                                  0 |
| `dc96c29`, after the arithmetic and evaluation-order repairs |      45,485 / 136,208 |                                                  0 |

The second run consumes 32 more lines across 12 titles. That comparison
establishes parser progress. Verification of the solutions requires meaningful
readings, successful emission and executable comparisons with the originals.

## C++ standalone calls

The C++ solution for [Ascending primes](https://rosettacode.org/wiki/Ascending_primes)
illustrates the difference. Its 73 lines were all consumed at `dc96c29`.
Standalone calls to `suspected.push`, `suspected.pop` and `primes.push_back`
vanished because prototype detection counted pieces of a dotted name as a
return type. Both readers now require a return type before the full dotted or
namespace-qualified name. Their regression tests read the calls and emit them
beside an ordinary forward declaration.

```sh
node js/tests/member-calls.test.js
cargo test --test grammar standalone_cpp_member_and_namespace_calls_survive_beside_prototypes
node experiments/issue-16-cpp-member-calls.mjs
```

The compiled experiment calls `push_back`, `pop_back` and `push_back` on a
vector. The original prints `2`. Output translated at `16f5217` prints `1`,
and the repaired output prints `2`. The experiment can compare an older
checkout by passing its `js/src/index.js` as the sole argument.

Ascending primes also relies on native library and template calls. The explicit
template arguments in `ostream_iterator<unsigned>(...)` were read as comparison
operators. Behavioral verification of the complete task remains open.
