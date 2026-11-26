# Concrete syntax in the translation pipeline

The default readers retain a concrete source record in `sourceTree.syntax`.
Its token and trivia leaves partition the original text:
quotes, comment markers, whitespace, line endings, directives and file headers
remain present. `reconstructConcrete(sourceTree.syntax)` in JavaScript, or
`reconstruct_concrete` in Rust, concatenates those leaves to reproduce the input.

Ranges are half-open UTF-8 byte offsets in both implementations. A production
records its grammar rule, the concept it produces and its source range. Productions
are views over the shared token stream, so a transformation can retain its source
without copying the entire text into every node. Synthetic indentation and
end-of-file tokens consume no source bytes.

The `parsed` trace callback receives this record for formal languages, controlled
natural languages and all seven machine formats. A decorator around the formal
`parse` stage also receives it before understanding rules derive a meta program.
No tracing is enabled by default. Existing custom readers remain replaceable
through the stage API.

```js
import {
  createTranslator,
  reconstructConcrete,
} from '@link-foundation/universal-translator';

const translator = createTranslator({
  trace(stage, tree) {
    if (stage === 'parsed') {
      console.log(reconstructConcrete(tree.syntax));
    }
  },
});
translator.translate('const x = 1;\r\n', 'javascript', 'python');
```

The semantic view remains responsible for understanding and lowering operations;
the concrete record owns their original spelling. This follows the separation
between source tokens and rewrites in
[ANTLR's token stream rewriter](https://github.com/antlr/antlr4/blob/master/runtime/Java/src/org/antlr/v4/runtime/TokenStreamRewriter.java)
and the explicit source ranges used by
[tree-sitter](https://tree-sitter.github.io/tree-sitter/using-parsers/3-advanced-parsing.html).

`translator.parsePartial(source, language).syntax` in JavaScript, or
`translator.parse_partial(source, language)?.syntax` in Rust, also retains
incomplete input, including unclosed literals and unsupported constructs. Its
`productions` describe accepted fragments; its `errors` contain unread byte
ranges and diagnostic messages. Whitespace-only and empty inputs have a complete
record with no productions or errors. The original CRLF endings and indentation
remain intact even though fragment recovery dedents its semantic inputs.

The formal parser records its actual grammar tokens and production methods.
Line-oriented readers and recovery use lossless word/symbol leaves and layout
trivia; accepted semantic concepts have `source-lines` production views. A
concept assembled from separate instruction ranges has separate views rather
than claiming ownership of the instructions between them. Recovery's `fragment`
views describe accepted parts, while unread parts appear only in `errors`.

Grammar import/update and exact subline ranges through every semantic rewrite
remain tracked work in issue 16. Retaining the concrete source alone does not
establish a semantic mapping between two translated programs.
