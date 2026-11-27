//! Formal languages: the 32 programming languages and the machine targets
//! (assembly dialects and intermediate languages). Each language is data in
//! [`languages`]; the shared [`parser`] and [`emitter`] read and write it,
//! dialects extend them, and machine code is lowered and lifted.

pub mod array_spellings;
pub mod arrays;
pub(crate) mod comment_syntax;
pub mod common_library;
pub mod dialects;
pub(crate) mod documentation;
pub mod emitter;
mod exceptions;
pub mod for_each;
pub mod interpolation;
pub mod languages;
pub mod lexer;
pub mod lifting;
pub mod lowering;
pub mod machine;
pub mod machine_assembly;
mod machine_languages;
pub mod machine_llvm;
pub mod machine_reader;
pub mod machine_reader_assembly;
pub mod machine_reader_llvm;
pub mod machine_reader_shared;
pub mod machine_reader_wasm;
pub mod machine_shared;
pub mod machine_wasm;
pub mod more_languages;
pub mod names;
pub mod numbers;
pub(crate) mod objpak;
mod objpak_objc;
mod objpak_reader;
pub(crate) mod objpak_runtime;
pub(crate) mod objpak_writer;
pub mod parser;
pub(crate) mod power;
pub mod query_languages;
pub(crate) mod query_writer;
pub(crate) mod questions;
pub mod rocq_runtime;
pub mod rules;
mod text_writing;
mod type_metadata;
pub mod versions;
