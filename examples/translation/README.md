# Program translation examples

The programs in [`../programs`](../programs) are the main examples. Each
JavaScript program there has been translated into every supported target
under [`../programs/translated`](../programs/translated). The JavaScript and
Rust tests both compare their output with those files.

## Translate from the command line

```sh
node bin/universal-translator.js translate javascript python examples/programs/factorial.js
node bin/universal-translator.js translate ruby go examples/programs/hand-written/fizz-buzz.rb
node bin/universal-translator.js translate javascript java examples/programs/hello-world.js --mode literal
node bin/universal-translator.js translate javascript cil examples/programs/sum-of-squares.js
node bin/universal-translator.js meta python examples/programs/hand-written/greatest-common-divisor.py
```

The `meta` command prints the typed meta program as JSON. It is the same
structure that the rule layers receive. `languages` lists every identifier and
its display name; the machine targets come last and carry `machine: true` in
the JavaScript and Rust `languages()`. The machine targets work in both
directions, so every dialect translates into each other and into every
language:

| id      | label                          | file     |
| ------- | ------------------------------ | -------- |
| `nasm`  | x86-64 assembly (NASM)         | `.asm`   |
| `gas`   | x86-64 assembly (GNU as, AT&T) | `.s`     |
| `arm64` | ARM64 assembly                 | `.arm64` |
| `cil`   | CIL (ILAsm)                    | `.il`    |
| `jvm`   | JVM bytecode (Jasmin)          | `.j`     |
| `llvm`  | LLVM IR                        | `.ll`    |
| `wat`   | WebAssembly text               | `.wat`   |

```sh
node bin/universal-translator.js translate jvm nasm examples/programs/translated/factorial/factorial.j
node bin/universal-translator.js translate nasm python examples/programs/translated/fizz-buzz/fizz-buzz.asm
```

Machine code is read by `machine-reader.js`, which matches the instruction
sequences that `machine.js` writes and returns stack machine code. Then
`lifting.js` rebuilds the meta program from it. It uses a symbolic stack for
expressions and recognizes the jump patterns of conditions (including `and`,
`or` and `not`), `if`/`else if`/`else`, `while`, counting loops and boolean
values. Variable names survive the round trip, because the machine code keeps
them: NASM `%define %$name`, gas and ARM64 `.set` names, CIL named parameters
and locals, Jasmin `.var` directives, LLVM IR `%name.addr` slots and WebAssembly
`$name` locals. Lifting `x → machine → meta` and lowering again gives the
same machine code.

## Translate from JavaScript

```js
import {
  createTranslator,
  translate,
} from '@link-foundation/universal-translator';

translate('console.log("Hi");', 'javascript', 'python');

// A layer is a list of rules. Each rule takes the meta program and the
// settings { from, to, mode } and returns a meta program.
const traceRule = (program, { to }) => {
  console.error(`translating ${program.functions.length} functions to ${to}`);
  return program;
};
const translator = createTranslator({
  layers: [[traceRule]],
  trace: (stage, tree) => console.error(stage, tree.kind),
});
translator.translate(source, 'javascript', 'rust', { mode: 'same-effect' });
```

Layers run in order after the meaning rules and before the context rules, so
each one is a meta→meta transformation. You can also replace the default rule
lists (`understanding`, `meaning`, `context`) or any stage (`parse`, `infer`,
`emit`, `emitMachineCode`). To decorate a rule, wrap it in a function that
calls it. `toMeta` and `fromMeta` expose the two halves of the pipeline.

[`custom-layer.mjs`](custom-layer.mjs) runs this example.

## Translate through the common library

```sh
node bin/universal-translator.js translate javascript python examples/programs/fizz-buzz.js --common-library
node examples/programs/verify-native.mjs --common-library
```

With `--common-library` every print becomes a call to the small library in
[`common-library/`](../../common-library): `printLine`, `writeText`,
`writeInteger` and `endLine`, spelled in each language's naming convention.
The output part of the program is then the same line for line in every
language. Reading such a program back recognizes the calls, drops the library
import and joins the writes into one print again.

## Change comments without changing the code

```sh
node examples/translation/comment-glossary.mjs examples/translation/hello-ru.cs
```

`commentGlossary(phrases)` is a rule that replaces phrases in every comment.
The example reads the phrases from
[`data/translation/comment-glossary.lino`](../../data/translation/comment-glossary.lino)
and translates C# to C#, so only the Russian comments become English. A
project or organization can keep its own glossary and rules in the same way.

## Check translations with native toolchains

```sh
node examples/programs/write-translations.mjs --check
node examples/programs/verify-native.mjs              # skips missing tools
node examples/programs/verify-native.mjs nasm gas llvm wat # only these targets
node examples/programs/verify-native.mjs --require-all
```

`verify-native.mjs` builds and runs every translated and hand-written program
and compares its output with the JavaScript original. It uses `nasm` and `gcc`
for assembly, `ILASM` (an ilasm path) and `dotnet` for CIL, and `jasmin` or
`JASMIN_CLASSPATH` with `java` for JVM bytecode, `as` and `gcc` for GNU as,
`lli` for LLVM IR, and `wat2wasm` with `node` for WebAssembly text. ARM64
assembly runs with `gcc` on an ARM64 host, or with `ARM64_CC` and `ARM64_RUN`
(`qemu-aarch64`) elsewhere. Set `LUA` to pick the Lua
interpreter.

## Rank natural-language referents

`node examples/translation/dependent-meanings.mjs` ranks the possible
meanings of an ambiguous sentence. The data is in
[`data/translation/referents.lino`](../../data/translation/referents.lino) and
the result is checked against `relative-meta-logic`.

## Exchange source documents

`encode-source <language>` and `decode-source` turn source into a lossless
Links Notation document and back. `encode-cst` and `decode-cst` do the same
for Meta Language grammar trees. `experiments/verify-syntax-exchange.sh`
checks that the JavaScript and Rust command lines produce the same documents
for `hello.c` and `hello.cs`.
