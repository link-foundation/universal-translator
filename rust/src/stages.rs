//! The replaceable stages of the translation pipeline, and the decorator
//! API that wraps them. A decorator receives the inner implementation of a
//! stage and returns a wrapped one, so it can log calls, rewrite inputs or
//! outputs, cache or fall back; decorators of one stage compose in the
//! order they are added, the last added wrapping all the earlier ones. The
//! JavaScript twin is js/src/translation/decorators.js.

use crate::formal::lowering::LoweredProgram;
use crate::formal::{emitter, languages::Syntax, lifting, machine, machine_reader, parser};
use crate::meta::{GrammarError, Node, types};
use crate::natural::{self, Language};
use std::sync::Arc;

/// Source text and syntax -> source tree.
pub type ParseStage = Arc<dyn Fn(&str, &Syntax) -> Result<Node, GrammarError> + Send + Sync>;
/// Meta program -> typed meta program.
pub type InferStage = Arc<dyn Fn(Node) -> Node + Send + Sync>;
/// Machine instructions -> meta program.
pub type LiftStage = Arc<dyn Fn(&LoweredProgram) -> Result<Node, GrammarError> + Send + Sync>;
/// Machine code text and target -> machine instructions.
pub type ReadMachineStage =
    Arc<dyn Fn(&str, &str) -> Result<LoweredProgram, GrammarError> + Send + Sync>;
/// Words, the natural language id and the language (the catalog one, or
/// one with more templates) -> meta program.
pub type ReadNaturalStage =
    Arc<dyn Fn(&str, &str, &Language) -> Result<Node, GrammarError> + Send + Sync>;
/// Adapted meta program and target -> text. The programming language
/// emitter, the machine code emitter and the natural language writer all
/// have this shape.
pub type EmitStage = Arc<dyn Fn(&Node, &str) -> Result<String, GrammarError> + Send + Sync>;

/// The stages a [`crate::Translator`] runs.
#[derive(Clone)]
pub struct Stages {
    pub parse: ParseStage,
    pub infer: InferStage,
    pub lift: LiftStage,
    pub read_machine: ReadMachineStage,
    pub read_natural: ReadNaturalStage,
    pub emit: EmitStage,
    pub emit_machine: EmitStage,
    pub write_natural: EmitStage,
}

impl Default for Stages {
    fn default() -> Self {
        Stages {
            parse: Arc::new(parser::parse_program),
            infer: Arc::new(types::infer_types),
            lift: Arc::new(lifting::lift_program),
            read_machine: Arc::new(machine_reader::read_machine),
            read_natural: Arc::new(|source, _, language| {
                natural::read_natural_with(source, language).map_err(GrammarError::new)
            }),
            emit: Arc::new(emitter::emit_program),
            emit_machine: Arc::new(machine::emit_machine),
            write_natural: Arc::new(|program, id| {
                natural::write_natural(program, id).map_err(GrammarError::new)
            }),
        }
    }
}
