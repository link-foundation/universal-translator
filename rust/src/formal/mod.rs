//! Formal languages: the 30 programming languages and the machine targets
//! (x86-64 assembly, CIL and JVM bytecode). Each language is data in
//! [`languages`]; the shared [`parser`] and [`emitter`] read and write it,
//! dialects extend them, and machine code is lowered and lifted.

pub mod array_spellings;
pub mod arrays;
pub mod common_library;
pub mod dialects;
pub mod emitter;
pub mod interpolation;
pub mod languages;
pub mod lexer;
pub mod lifting;
pub mod lowering;
pub mod machine;
pub mod machine_reader;
pub mod names;
pub mod parser;
pub mod rocq_runtime;
pub mod rules;
