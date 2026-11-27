# Corpus frequencies for ambiguous readings

Both translators check whether each grammar can read the complete text.
Complete grammar readings and prose whose words are all recognized precede
partial readings. Syntax and vocabulary evidence rank readings of comparable
coverage. When code readings have equal evidence, the translator prefers the
language represented by more distinct tasks in the committed Rosetta Code
report. English remains the preference for a tied, fully parseable bare name
such as `c`, as requested in Issue 16.

The report covers 1,782 tasks and 32 code languages. For `c`, which is equally
readable by the competing code grammars, Julia (1,740) precedes Python (1,674)
and Java (1,635). The former fixed list placed Python and Java ahead of Julia.
The counts describe language representation in this Rosetta Code snapshot.
[Committed report](../issue-8/data/rosetta-code/coverage.json)

For the Russian noun «мир» and four inflected forms, the translators use
relative frequencies from the 36,385 aligned English–Russian sentence pairs in
the Helsinki-NLP Tatoeba Challenge test release. The counter case-folds and
tokenizes both sentences. It counts the Russian noun when exactly one English
gloss occurs (`world` or `worlds` for “world”, `peace` for “peace”). It counts
each distinct normalized Russian sentence once and excludes sentences whose
alignments support both readings. The resulting counts are 119 and 10. These
are lexical co-occurrence estimates for that sample. The bilingual release
attributes sentence data to the original contributors.
[Pinned data release](https://github.com/Helsinki-NLP/Tatoeba-Challenge/tree/bd05f087e91e359a88594bd6d6c99a079e0ac621/data/release/test/v2023-09-26)
· [Corpus project](https://github.com/Helsinki-NLP/Tatoeba-Challenge/tree/bd05f087e91e359a88594bd6d6c99a079e0ac621)

Both `--candidates` and prose meta expose the observed proportions. The
probability calculation still multiplies frequency by how much meaning the
translation retains on the round trip. The alternate “peace” interpretation
has a frequency of `0.077519` and round-trip similarity of zero for the
standalone word. Phrases without observations for all available readings
continue to use dictionary order and a Zipf prior. Code statistics currently
rank language candidates. They do not model conflicting meanings inside one
grammar or relative code/prose prevalence.

To regenerate the aggregate, download the pinned `.txt.gz` listed in
[`corpus-frequencies.json`](../../../data/translation/corpus-frequencies.json)
and compare the output with the checked-in file. The generator verifies both
data-source digests and independently recounts the tasks in the Rosetta report.

```sh
node experiments/issue-16-corpus-frequencies.mjs /path/to/tatoeba-eng-rus.txt.gz --check
```

The two language-detection and ranking suites check the corpus ordering,
partial readers, the five noun forms, the remaining Zipf case, and exact
candidate and meta probabilities in JavaScript and Rust.

The first application build grouped the shared corpus reader with the main
translator. The natural-language bundle then imported that reader while the
main translator imported the natural-language bundle. The existing
dependency-graph test identified `translator -> translator-natural ->
translator` on Node, Bun, and Deno. Vite reported the same cycle on line 220 of
the [web build log](https://github.com/link-foundation/universal-translator/actions/runs/46059345768/job/140709534044).
The corpus reader now has a shared chunk with no imports from either bundle.
The dependency-graph test passes and Vite builds the web application without
the cycle warning.
