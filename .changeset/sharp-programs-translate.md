---
'@link-foundation/universal-translator': minor
---

Add source-preserving program translation, configurable transformation rules, and a CLI. JavaScript and Rust share Links Notation profiles for Hello World, Greatest Common Divisor, and FizzBuzz across 50 programming and 20 natural languages. Both implementations can translate to and from the Links Notation effect itself. Five textual instruction profiles support the Hello World fixture. NASM x86-64 also supports Greatest Common Divisor and FizzBuzz.

Both packages preserve any UTF-8 source as an ordered Links Notation document. JavaScript and Rust also share an optional set of callable operations for text output with or without a trailing newline, Greatest Common Divisor, and FizzBuzz.

JavaScript and Rust also translate a callable GCD function with signed integer inputs. The callable GCD and text-output variants have instructions in all 20 natural-language profiles.

Recognize all seven pinned JavaScript and Rust Rosetta Code Ackermann listings. Compare function results and command-line output for all 20 bounded input pairs. Preserve the exact decimal and JSON output of the standalone programs.

Translate FizzBuzz variants that write lowercase results, quote each result, or add a final blank line. The common library forms and all 20 natural-language profiles preserve the exact output layout.

Translate FizzBuzz functions that print only when called or return a string joined by spaces or newlines. The native checks compare the original JavaScript listings with Rust and verify the callable and common-library forms.

Translate the generator-based Rosetta Code FizzBuzz listing to Rust and verify all 100 lowercase output lines against the original.

Translate the pinned Hello World Newbie console programs and browser alert. Rust emits a WebAssembly module that uses an explicit browser alert import. Playwright verifies both versions in Chrome.

Preserve JavaScript document writes through a Rust browser import, and translate QuickJS print calls to an equivalent console line. The corpus replay checks the original and translated behavior in their hosts.

Translate an empty program between JavaScript, Rust, Links Notation, and all 20 natural-language profiles. Verify the original Rust specimen and the generated JavaScript program for a successful exit and empty output streams.

Expose Meta Language grammar CST encoding and decoding in the Rust CLI and a JavaScript codec for the matching Meta Language 1.0 engine. Preserve grammar nodes, parser provenance, and UTF-8 source bytes in the exchanged Links Notation network.

Use grammar trees in the translator's source graphs when the matching parser is available. Compile supported JavaScript and Rust programs through Meta Language's checked portable core from source text or an exchanged Links Notation CST.

Keep translated algorithms in generated JavaScript and Rust programs. Use the optional common library for standard output. 
