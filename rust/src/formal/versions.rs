//! Versions of a programming language: the major versions and grammar
//! variations it is written in. A version only changes how programs are
//! written; reading accepts every version of the language, so one Python
//! reads both `print "Hi"` and `print("Hi")`.
//!
//! A language id may name its version after "@": `python@2`. The JavaScript
//! twin is js/src/formal/versions.js.

use super::languages::{ArrayFill, IntegerDivision, Syntax};
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

/// ES5 has no let, const, template strings, Math.trunc,
/// Array.prototype.fill or for...of: variables are `var`, text is joined
/// with +, integers are truncated with `~~`, a filled array is created and
/// then filled by a loop, and a for-each loop counts over the indexes of its
/// array.
fn javascript_es5(syntax: &mut Syntax) {
    syntax.for_each = None;
    syntax.declaration_keyword = Some("var");
    syntax.text_join_concatenation = true;
    syntax.integer_division = Some(IntegerDivision::Wrapper("~~"));
    syntax.array_fill = Some(ArrayFill::Always);
}

/// PHP 5 has no intdiv() and writes arrays as `array(...)`.
fn php_5(syntax: &mut Syntax) {
    syntax.integer_division = Some(IntegerDivision::Wrapper("(int) "));
}

/// C# 5 has no `$"..."` strings: computed parts are converted with
/// Convert.ToString and joined with +.
fn csharp_5(syntax: &mut Syntax) {
    syntax.text_join_concatenation = true;
    syntax.text_conversions = &["System.Convert.ToString"];
}

/// Before 5.3 Lua has no `//` operator: `math.floor` rounds the quotient
/// down, as `//` does.
fn lua_5_1(syntax: &mut Syntax) {
    syntax.operators.integer_divide = None;
    syntax.integer_division = Some(IntegerDivision::Wrapper("math.floor"));
}

const fn version(version: &'static str, label: &'static str, default: bool) -> Version {
    Version {
        version,
        label,
        default,
    }
}

const LANGUAGE_VERSIONS: &[LanguageVersions] = &[
    LanguageVersions {
        id: "javascript",
        versions: &[
            (
                version(
                    "es6",
                    "ECMAScript 2015 and later (let, const, template strings)",
                    true,
                ),
                no_change,
            ),
            (version("es5", "ECMAScript 5", false), javascript_es5),
        ],
    },
    LanguageVersions {
        id: "php",
        versions: &[
            (
                version("7", "PHP 7 and later (short arrays, intdiv)", true),
                no_change,
            ),
            (version("5", "PHP 5", false), php_5),
        ],
    },
    LanguageVersions {
        id: "csharp",
        versions: &[
            (
                version("6", "C# 6 and later (string interpolation)", true),
                no_change,
            ),
            (version("5", "C# 5", false), csharp_5),
        ],
    },
    LanguageVersions {
        id: "python",
        versions: &[
            (version("3", "Python 3 (3.6+, f-strings)", true), no_change),
            (version("2", "Python 2.7", false), python_2),
        ],
    },
    LanguageVersions {
        id: "lua",
        versions: &[
            (
                version("5.3", "Lua 5.3+ (integer division //)", true),
                no_change,
            ),
            (version("5.1", "Lua 5.1 and 5.2 (LuaJIT)", false), lua_5_1),
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
