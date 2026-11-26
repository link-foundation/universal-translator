//! The versions of a programming language and the ids that name them.

use universal_translator::{split_version, versions_of};

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
