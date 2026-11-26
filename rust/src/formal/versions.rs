//! Versions of a programming language: the major versions and grammar
//! variations it is written in. A version only changes how programs are
//! written; reading accepts every version of the language, so one Python
//! reads both `print "Hi"` and `print("Hi")`.
//!
//! A language id may name its version after "@": `python@2`. The JavaScript
//! twin is js/src/formal/versions.js.

use super::languages::{IntegerDivision, Syntax};
use crate::meta::GrammarError;

/// One version of a language.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Version {
    pub version: &'static str,
    pub label: &'static str,
    /// Whether programs are written in this version when none is named.
    pub default: bool,
}

/// A version and how it changes the syntax of its language.
type VersionChange = (Version, fn(&mut Syntax));

/// The versions of a language and how each changes its syntax.
struct LanguageVersions {
    id: &'static str,
    versions: &'static [VersionChange],
}

fn no_change(_: &mut Syntax) {}

/// Python 2 has no f-strings: computed parts are converted with `str()` and
/// concatenated; print is a statement.
fn python_2(syntax: &mut Syntax) {
    syntax.text_join_concatenation = true;
    syntax.print_statement = true;
}

/// Before 5.3 Lua has no `//` operator: `math.floor` rounds the quotient
/// down, as `//` does.
fn lua_5_1(syntax: &mut Syntax) {
    syntax.operators.integer_divide = None;
    syntax.integer_division = Some(IntegerDivision::Wrapper("math.floor"));
}

/// `intdiv` arrived in PHP 7; `intval` drops the fraction of the quotient
/// the same way.
fn php_5(syntax: &mut Syntax) {
    syntax.integer_division = Some(IntegerDivision::Wrapper("intval"));
}

/// Before C# 6 there are no `$"..."` strings: text is joined with `+`,
/// which converts the computed parts itself.
fn csharp_5(syntax: &mut Syntax) {
    syntax.text_join_concatenation = true;
}

/// A version that is written when none is named.
const fn current(version: &'static str, label: &'static str) -> VersionChange {
    (
        Version {
            version,
            label,
            default: true,
        },
        no_change,
    )
}

/// A version that is only written when it is named.
const fn older(
    version: &'static str,
    label: &'static str,
    change: fn(&mut Syntax),
) -> VersionChange {
    (
        Version {
            version,
            label,
            default: false,
        },
        change,
    )
}

const LANGUAGE_VERSIONS: &[LanguageVersions] = &[
    LanguageVersions {
        id: "python",
        versions: &[
            current("3", "Python 3 (3.6+, f-strings)"),
            older("2", "Python 2.7", python_2),
        ],
    },
    LanguageVersions {
        id: "lua",
        versions: &[
            current("5.3", "Lua 5.3+ (integer division //)"),
            older("5.1", "Lua 5.1 and 5.2 (LuaJIT)", lua_5_1),
        ],
    },
    LanguageVersions {
        id: "php",
        versions: &[current("7", "PHP 7+ (intdiv)"), older("5", "PHP 5", php_5)],
    },
    LanguageVersions {
        id: "csharp",
        versions: &[
            current("6", "C# 6+ (interpolated strings)"),
            older("5", "C# 5", csharp_5),
        ],
    },
];

/// `python@2` -> (`python`, `Some("2")`).
pub fn split_version(identifier: &str) -> (&str, Option<&str>) {
    match identifier.split_once('@') {
        Some((id, version)) => (id, Some(version)),
        None => (identifier, None),
    }
}

/// The versions of a language, the default first, for menus.
pub fn versions_of(id: &str) -> Vec<Version> {
    let mut versions: Vec<Version> = LANGUAGE_VERSIONS
        .iter()
        .filter(|described| described.id == id)
        .flat_map(|described| described.versions.iter().map(|(version, _)| *version))
        .collect();
    // A stable sort keeps the listing order of the other versions.
    versions.sort_by_key(|version| !version.default);
    versions
}

/// A syntax with the changes of a version (none for the default version).
pub fn with_version(mut syntax: Syntax, version: Option<&str>) -> Result<Syntax, GrammarError> {
    let Some(version) = version else {
        return Ok(syntax);
    };
    let (described, change) = LANGUAGE_VERSIONS
        .iter()
        .filter(|described| described.id == syntax.id)
        .flat_map(|described| described.versions.iter())
        .find(|(described, _)| described.version == version)
        .ok_or_else(|| GrammarError::new(format!("{} has no version \"{version}\"", syntax.id)))?;
    change(&mut syntax);
    syntax.version = Some(described.version);
    Ok(syntax)
}
