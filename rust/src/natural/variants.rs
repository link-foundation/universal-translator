//! Versions of a natural language. A menu lists each natural language once
//! (one English, one Russian); its versions are:
//!
//! - region: regional spellings (American and British English), chosen from
//!   the reader's browser languages
//! - vocabulary: smaller vocabularies to downgrade to, from the full
//!   vocabulary of the language down to its semantic primes
//! - standard: controlled language standards with rules of their own
//!
//! The full vocabulary of the language is the default version. The
//! JavaScript twin is js/src/natural/variants.js (which also lists the
//! standards of one's own registered at run time, as "own").

use std::cmp::Ordering;

use super::catalog::{natural_language, natural_language_ids};

/// What a version of a natural language is.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub enum VersionKind {
    Full,
    Region,
    Vocabulary,
    Standard,
}

impl VersionKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Full => "full",
            Self::Region => "region",
            Self::Vocabulary => "vocabulary",
            Self::Standard => "standard",
        }
    }
}

/// One version of a natural language.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct NaturalVersion {
    pub id: &'static str,
    pub label: &'static str,
    pub kind: VersionKind,
    /// The size of the vocabulary where the standard fixes one (in words).
    pub words: Option<usize>,
    /// Whether the vocabulary is the semantic primes.
    pub primes: bool,
    pub default: bool,
}

/// What each profile is, and the size of its vocabulary where the standard
/// fixes one.
fn profile(name: &str) -> (VersionKind, Option<usize>, bool) {
    match name {
        "cnl-default" => (VersionKind::Region, None, false),
        "special-english" | "globish" => (VersionKind::Vocabulary, Some(1500), false),
        "asd-ste100" => (VersionKind::Vocabulary, Some(875), false),
        "basic-english" => (VersionKind::Vocabulary, Some(850), false),
        "minimal-english" => (VersionKind::Vocabulary, Some(65), true),
        _ => (VersionKind::Standard, None, false),
    }
}

/// Browser language tags that pick a regional version.
const REGIONS: &[(&str, &[&str])] = &[(
    "english-british",
    &["en-GB", "en-AU", "en-NZ", "en-IE", "en-ZA", "en-IN"],
)];

/// The language a version belongs to (`minimal-english` -> `english`).
pub fn base_of(id: &str) -> Result<&'static str, String> {
    let language = natural_language(id)?;
    Ok(match &language.base {
        Some(base) => natural_language(base)?.id.as_str(),
        None => language.id.as_str(),
    })
}

/// The natural languages a menu lists: one entry per language.
pub fn base_natural_language_ids() -> Vec<&'static str> {
    natural_language_ids()
        .into_iter()
        .filter(|id| natural_language(id).is_ok_and(|language| language.base.is_none()))
        .collect()
}

/// Every version of a natural language, the default (full vocabulary)
/// first, then regional spellings, smaller vocabularies from the largest
/// down to the semantic primes, and the controlled language standards.
pub fn natural_language_versions(id: &str) -> Result<Vec<NaturalVersion>, String> {
    let base = base_of(id)?;
    let mut versions = Vec::new();
    for other in natural_language_ids() {
        if base_of(other)? != base {
            continue;
        }
        let language = natural_language(other)?;
        let (kind, words, primes) = if other == base {
            (VersionKind::Full, None, false)
        } else {
            profile(language.profile.as_deref().unwrap_or_default())
        };
        versions.push(NaturalVersion {
            id: language.id.as_str(),
            label: language.label.as_str(),
            kind,
            words,
            primes,
            default: other == base,
        });
    }
    versions.sort_by(|left, right| {
        left.kind
            .cmp(&right.kind)
            .then_with(|| match (left.words, right.words) {
                (Some(left), Some(right)) => right.cmp(&left),
                (Some(_), None) => Ordering::Greater,
                (None, Some(_)) => Ordering::Less,
                (None, None) => Ordering::Equal,
            })
            .then_with(|| left.id.cmp(right.id))
    });
    Ok(versions)
}

/// The version of a natural language that fits the reader's languages
/// (navigator.languages, most preferred first): the first tag of the same
/// language decides, so en-GB picks British English and en-US the default.
pub fn preferred_natural_version<S: AsRef<str>>(
    id: &str,
    browser_languages: &[S],
) -> Result<&'static str, String> {
    let base = base_of(id)?;
    let mut regional = Vec::new();
    for (version, tags) in REGIONS {
        if base_of(version)? == base {
            regional.push((natural_language(version)?.id.as_str(), *tags));
        }
    }
    for tag in browser_languages
        .iter()
        .map(|tag| tag.as_ref().to_lowercase())
    {
        for (version, tags) in &regional {
            if tags.iter().any(|known| known.to_lowercase() == tag) {
                return Ok(version);
            }
            let language = tag.split('-').next().unwrap_or_default();
            if tags
                .iter()
                .any(|known| known.split('-').next().unwrap_or_default().to_lowercase() == language)
            {
                return Ok(base);
            }
        }
    }
    Ok(base)
}

/// The version of a natural language with the vocabulary of its semantic
/// primes (Minimal English, Minimal Russian, ...), if it has one.
pub fn primes_version(id: &str) -> Result<Option<&'static str>, String> {
    Ok(natural_language_versions(id)?
        .into_iter()
        .find(|version| version.primes)
        .map(|version| version.id))
}
