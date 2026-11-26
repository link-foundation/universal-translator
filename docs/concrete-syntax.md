# Concrete syntax in the translation pipeline

The default formal-language parser retains a concrete source record in
`sourceTree.syntax`. Its token and trivia leaves partition the original text:
quotes, comment markers, whitespace, line endings, directives and file headers
remain present. `reconstructConcrete(sourceTree.syntax)` in JavaScript, or
`reconstruct_concrete` in Rust, concatenates those leaves to reproduce the input.

Ranges are half-open UTF-8 byte offsets in both implementations. A production
records its grammar rule, the concept it produces and its source range. Productions
are views over the shared token stream, so a transformation can retain its source
without copying the entire text into every node. Synthetic indentation and
end-of-file tokens consume no source bytes.

The `parsed` trace callback and a decorator around the `parse` stage receive this
record before understanding rules derive a meta program. No tracing is enabled
by default. Existing custom parsers remain replaceable through the stage API.

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

The current record covers successful parses by the shared formal-language parser
and its dialects. Natural-language and machine readers, syntax-error recovery,
grammar import/update, and carrying ranges through all semantic rewrites and
emitters remain tracked work in issue 16. Retaining the concrete source alone
does not establish a semantic mapping between two translated programs.
