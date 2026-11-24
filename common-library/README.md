# Common library

The issue describes a "common library" route for translation. Each
language gets a small library with the same operations. A program is
translated to the meta language, its print statements are replaced by
calls to the library, and then translation into another language that has
the same library is nearly line for line.

The library only smooths over standard-library differences. It has no
algorithms. Every implementation has these four operations, with names
spelled by each language's convention:

| Operation               | Effect                       |
| ----------------------- | ---------------------------- |
| `printLine(text)`       | write the text and a newline |
| `writeText(text)`       | write the text               |
| `writeInteger(integer)` | write the integer in decimal |
| `endLine()`             | write a newline              |

Translate with the library like this:

```sh
node bin/universal-translator.js translate javascript python examples/programs/fizz-buzz.js --common-library
```

`examples/programs/verify-native.mjs --common-library` runs every
translation next to its language's library and compares the output with
the original. Reading a program that calls the library gives back plain
print statements, so library programs translate to any language.
