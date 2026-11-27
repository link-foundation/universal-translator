//! The for-each loop of the meta language is lowered and raised in
//! meta/for_each.rs; this rule decides which languages keep it.

use super::languages::language_syntax;
use crate::meta::Node;
use crate::meta::Settings;
use crate::meta::for_each::{is_plain, lower_for_each};

pub use crate::meta::for_each::raise_for_each;

/// Languages without a for-each loop write a counting loop over an index, and
/// so do loops that change their own variable or array.
pub fn expand_for_each(program: Node, settings: &Settings) -> Node {
    let native = language_syntax(&settings.target)
        .ok()
        .is_some_and(|syntax| syntax.for_each.is_some());
    lower_for_each(program, &|each| {
        (native
            || settings.to == "objc"
                && each.node("array").and_then(|a| a.str("type")) == Some("set<text>"))
            && is_plain(each)
    })
}
