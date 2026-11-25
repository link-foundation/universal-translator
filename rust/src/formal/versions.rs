//! Versions of a programming language: the major versions and grammar
//! variations it is written in. A version only changes how programs are
//! written; reading accepts every version of the language, so one Python
//! reads both `print "Hi"` and `print("Hi")`.
//!
//! A language id may name its version after "@": `python@2`. The JavaScript
//! twin is js/src/formal/versions.js.

use super::languages::Syntax;
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

const LANGUAGE_VERSIONS: &[LanguageVersions] = &[LanguageVersions {
    id: "python",
    versions: &[
        (
            Version {
                version: "3",
                label: "Python 3 (3.6+, f-strings)",
                default: true,
            },
            no_change,
        ),
        (
            Version {
                version: "2",
                label: "Python 2.7",
                default: false,
            },
            python_2,
        ),
    ],
}];

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splits_a_version_from_an_id() {
        assert_eq!(split_version("python@2"), ("python", Some("2")));
        assert_eq!(split_version("python"), ("python", None));
    }

    #[test]
    fn lists_the_default_version_first() {
        let listed: Vec<_> = versions_of("python")
            .into_iter()
            .map(|version| (version.version, version.default))
            .collect();
        assert_eq!(listed, vec![("3", true), ("2", false)]);
        assert!(versions_of("ruby").is_empty());
    }
}
