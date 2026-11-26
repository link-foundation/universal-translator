//! The imprecision of a meta program: where reading a source lost something
//! a translation cannot bring back. A node read imprecisely carries
//!
//! ```text
//!   (imprecision kind)   what was lost
//!   (alternatives n)     how many readings it had, when it had several
//!   (probability p)      the probability of the reading kept
//! ```
//!
//! Emitters write a program from its other fields and ignore these. The
//! kinds:
//!
//! - ambiguous: a word of prose that may mean several things
//!   (natural/prose_reading.rs);
//! - untranslated: a word of prose no meaning is known for
//!   (natural/prose_reading.rs);
//! - truncated: a number with a fraction typed as an integer, a language
//!   whose integers are integers drops the fraction;
//! - rounded: an integer beyond 2^53 - 1, the largest one a double keeps
//!   exactly, its digits past the 16th are lost.
//!
//! The JavaScript twin is js/src/meta/imprecision.js.

use super::tree::{Node, rewrite};

/// The largest integer a double keeps exactly.
const SAFE_INTEGER: f64 = 9_007_199_254_740_991.0;

/// What a number typed as an integer loses, if anything.
fn number_imprecision(node: &Node) -> Option<&'static str> {
    if node.str("type") != Some("integer") {
        return None;
    }
    let value = node.number("value")?;
    if !value.is_finite() || value.fract() != 0.0 {
        return Some("truncated");
    }
    (value.abs() > SAFE_INTEGER).then_some("rounded")
}

/// The program with the imprecision of each of its numbers recorded.
pub fn mark_imprecision(meta: Node) -> Node {
    rewrite(meta, |node| {
        if !node.is("Number") || node.str("imprecision").is_some() {
            return node;
        }
        match number_imprecision(&node) {
            Some(imprecision) => node.with("imprecision", imprecision),
            None => node,
        }
    })
}
