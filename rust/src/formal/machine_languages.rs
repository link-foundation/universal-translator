//! Lexical descriptions of assembly and intermediate-language targets.

use super::languages::{
    BOTH_QUOTES, C, Convention, ForwardDeclarations, METHOD_TERMS, Naming, SCRIPT_QUOTES, Syntax,
    Terms, same,
};

/// The machine targets: x86-64 assembly (NASM and GNU as in AT&T syntax),
/// ARM64 assembly, CIL, JVM bytecode, LLVM IR and WebAssembly text. Only the
/// label, naming, comment marker and terms are read, by the context rules.
pub const MACHINE_TARGETS: [Syntax; 7] = [
    Syntax {
        id: "nasm",
        label: "x86-64 assembly (NASM)",
        naming: same(Convention::Snake),
        line_comment: ";",
        block_comment: None,
        quotes: SCRIPT_QUOTES,
        terms: Terms {
            call: "call instruction",
            routine: "procedure",
        },
        machine: true,
        forward_declarations: ForwardDeclarations::None,
        ..C
    },
    Syntax {
        id: "gas",
        label: "x86-64 assembly (GNU as, AT&T)",
        naming: same(Convention::Snake),
        line_comment: "#",
        terms: Terms {
            call: "call instruction",
            routine: "function",
        },
        machine: true,
        forward_declarations: ForwardDeclarations::None,
        ..C
    },
    Syntax {
        id: "arm64",
        label: "ARM64 assembly",
        naming: same(Convention::Snake),
        line_comment: "//",
        terms: Terms {
            call: "branch instruction",
            routine: "function",
        },
        machine: true,
        forward_declarations: ForwardDeclarations::None,
        ..C
    },
    Syntax {
        id: "cil",
        label: "CIL",
        naming: Naming {
            function: Convention::Pascal,
            variable: Convention::Camel,
        },
        line_comment: "//",
        quotes: BOTH_QUOTES,
        terms: METHOD_TERMS,
        machine: true,
        forward_declarations: ForwardDeclarations::None,
        ..C
    },
    Syntax {
        id: "jvm",
        label: "JVM bytecode",
        naming: same(Convention::Camel),
        line_comment: ";",
        block_comment: None,
        terms: METHOD_TERMS,
        machine: true,
        forward_declarations: ForwardDeclarations::None,
        ..C
    },
    Syntax {
        id: "llvm",
        label: "LLVM IR",
        naming: same(Convention::Snake),
        line_comment: ";",
        block_comment: None,
        terms: Terms {
            call: "call instruction",
            routine: "function",
        },
        machine: true,
        forward_declarations: ForwardDeclarations::None,
        ..C
    },
    Syntax {
        id: "wat",
        nested_comments: true,
        label: "WebAssembly text",
        naming: same(Convention::Snake),
        line_comment: ";;",
        block_comment: Some(("(;", ";)")),
        terms: Terms {
            call: "call instruction",
            routine: "function",
        },
        machine: true,
        forward_declarations: ForwardDeclarations::None,
        ..C
    },
];
