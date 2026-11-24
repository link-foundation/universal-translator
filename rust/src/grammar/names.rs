//! Identifier naming. The meta language stores each name the program
//! declares as neutral lower-case words joined by "-" (for example
//! "greatest-common-divisor"); every language description states how it
//! spells such words. Names the program does not declare (library
//! procedures) are left exactly as written.

use std::collections::HashSet;
use std::sync::OnceLock;

use regex::Regex;

use super::languages::{Convention, Role};
use super::meta::{Node, rewrite, walk};

/// The words of an identifier: "greatestCommonDivisor",
/// "greatest_common_divisor" and "GreatestCommonDivisor" all become
/// `["greatest", "common", "divisor"]`.
pub fn name_words(identifier: &str) -> Vec<String> {
    static BOUNDARIES: OnceLock<[Regex; 2]> = OnceLock::new();
    let [lower_then_capital, acronym_end] = BOUNDARIES.get_or_init(|| {
        [
            Regex::new("([a-z0-9])([A-Z])").expect("valid pattern"),
            Regex::new("([A-Z])([A-Z][a-z])").expect("valid pattern"),
        ]
    });
    let spaced = lower_then_capital.replace_all(identifier, "${1} ${2}");
    let spaced = acronym_end.replace_all(&spaced, "${1} ${2}");
    spaced
        .split(|c: char| c.is_whitespace() || c == '_')
        .filter(|word| !word.is_empty())
        .map(str::to_lowercase)
        .collect()
}

fn capitalize(word: &str) -> String {
    let mut characters = word.chars();
    match characters.next() {
        Some(first) => first.to_uppercase().chain(characters).collect(),
        None => String::new(),
    }
}

/// Join words in a naming convention.
pub fn spell_words(words: &[&str], convention: Convention) -> String {
    match convention {
        Convention::Camel => words
            .iter()
            .enumerate()
            .map(|(index, word)| {
                if index == 0 {
                    (*word).to_owned()
                } else {
                    capitalize(word)
                }
            })
            .collect(),
        Convention::Pascal => words.iter().map(|word| capitalize(word)).collect(),
        Convention::Snake => words.join("_"),
    }
}

/// The neutral spelling of an identifier.
pub fn neutral_name(identifier: &str) -> String {
    name_words(identifier).join("-")
}

/// A neutral name spelled in a naming convention.
pub fn spell_name(neutral: &str, convention: Convention) -> String {
    spell_words(&neutral.split('-').collect::<Vec<_>>(), convention)
}

/// Every name the program itself introduces.
pub fn declared_names(program: &Node) -> HashSet<String> {
    let mut names = HashSet::new();
    for item in program.nodes("functions") {
        names.extend(item.str("name").map(str::to_owned));
        for parameter in item.nodes("parameters") {
            names.extend(parameter.str("name").map(str::to_owned));
        }
    }
    walk(program, |current| {
        let field = match current.kind.as_str() {
            "Declaration" => "name",
            "CountingLoop" => "variable",
            _ => return,
        };
        names.extend(current.str(field).map(str::to_owned));
    });
    names
}

/// Apply `rename(name, role)` to every declared name; the role tells
/// functions from variables so languages such as C# can spell methods
/// differently.
pub fn rename_declared(program: Node, rename: impl Fn(&str, Role) -> String) -> Node {
    let declared = declared_names(&program);
    let function_names: HashSet<String> = program
        .nodes("functions")
        .iter()
        .filter_map(|item| item.str("name").map(str::to_owned))
        .collect();
    let change = |identifier: &str| {
        if !declared.contains(identifier) {
            return identifier.to_owned();
        }
        let role = if function_names.contains(identifier) {
            Role::Function
        } else {
            Role::Variable
        };
        rename(identifier, role)
    };
    let rename_field = |mut node: Node, field: &str| {
        if let Some(identifier) = node.str(field).map(str::to_owned) {
            node.set(field, change(&identifier));
        }
        node
    };
    let mut renamed = rewrite(program, |current| match current.kind.as_str() {
        "Name" | "Declaration" | "Assignment" => rename_field(current, "name"),
        "Call" => rename_field(current, "callee"),
        "CountingLoop" => rename_field(current, "variable"),
        _ => current,
    });
    let functions: Vec<Node> = renamed
        .node_list("functions")
        .into_iter()
        .map(|item| {
            let parameters: Vec<Node> = item
                .node_list("parameters")
                .into_iter()
                .map(|parameter| rename_field(parameter, "name"))
                .collect();
            rename_field(item, "name").with("parameters", parameters)
        })
        .collect();
    renamed.set("functions", functions);
    renamed
}

/// Words each language reserves. A declared name spelled as one of them gets
/// a trailing underscore, which `name_words` drops again when reading it back.
const RESERVED_WORDS: &[(&str, &str)] = &[
    (
        "javascript",
        "break case catch class const continue debugger default delete do else export extends false finally for function if import in instanceof let new null return super switch this throw true try typeof var void while with yield await",
    ),
    (
        "typescript",
        "break case catch class const continue debugger default delete do else export extends false finally for function if import in instanceof let new null return super switch this throw true try typeof var void while with yield await enum",
    ),
    (
        "python",
        "and as assert async await break class continue def del elif else except false finally for from global if import in is lambda none nonlocal not or pass raise return true try while with yield print",
    ),
    (
        "ruby",
        "alias and begin break case class def defined do else elsif end ensure false for if in module next nil not or redo rescue retry return self super then true undef unless until when while yield",
    ),
    (
        "lua",
        "and break do else elseif end false for function goto if in local nil not or repeat return then true until while",
    ),
    (
        "php",
        "abstract and array as break callable case catch class clone const continue declare default do echo else elseif empty enddeclare endfor endforeach endif endswitch endwhile eval exit extends final finally fn for foreach function global goto if implements include instanceof insteadof interface isset list match namespace new or print private protected public readonly require return static switch throw trait try unset use var while xor yield",
    ),
    (
        "c",
        "auto break case char const continue default do double else enum extern float for goto if inline int long register restrict return short signed sizeof static struct switch typedef union unsigned void volatile while bool true false main",
    ),
    (
        "cpp",
        "and auto bool break case catch char class const continue default delete do double else enum explicit export extern false float for friend goto if inline int long mutable namespace new not or private protected public register return short signed sizeof static struct switch template this throw true try typedef typename union unsigned using virtual void volatile while xor main",
    ),
    (
        "csharp",
        "abstract as base bool break byte case catch char checked class const continue decimal default delegate do double else enum event explicit extern false finally fixed float for foreach goto if implicit in int interface internal is lock long namespace new null object operator out override params private protected public readonly ref return sbyte sealed short sizeof static string struct switch this throw true try typeof uint ulong unchecked unsafe ushort using virtual void volatile while",
    ),
    (
        "java",
        "abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static super switch synchronized this throw throws transient try void volatile while true false null var",
    ),
    (
        "go",
        "break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var true false nil main",
    ),
    (
        "rust",
        "as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self static struct super trait true type unsafe use where while main",
    ),
    (
        "kotlin",
        "as break class continue do else false for fun if in interface is null object package return super this throw true try typealias typeof val var when while",
    ),
    (
        "swift",
        "associatedtype class deinit enum extension fileprivate func import init inout internal let open operator private protocol public rethrows static struct subscript typealias var break case continue default defer do else fallthrough for guard if in repeat return switch where while as catch false is nil super self throw throws true try",
    ),
    (
        "perl",
        "if elsif else unless while until for foreach last next redo return my our local sub package use no require and or not xor eq ne lt gt le ge cmp print",
    ),
    (
        "dart",
        "abstract as assert async await break case catch class const continue covariant default deferred do dynamic else enum export extends extension external factory false final finally for function get hide if implements import in interface is late library mixin new null on operator part required rethrow return set show static super switch sync this throw true try typedef var void while with yield main",
    ),
    (
        "scala",
        "abstract case catch class def do else extends false final finally for forsome if implicit import lazy match new null object override package private protected return sealed super this throw trait try true type val var while with yield",
    ),
    (
        "julia",
        "baremodule begin break catch const continue do else elseif end export false finally for function global if import let local macro module quote return struct true try using while",
    ),
    (
        "r",
        "if else repeat while function for next break true false null inf nan na in",
    ),
    (
        "groovy",
        "abstract as assert boolean break byte case catch char class const continue def default do double else enum extends false final finally float for goto if implements import in instanceof int interface long native new null package private protected public return short static super switch synchronized this threadsafe throw throws transient true try var void volatile while",
    ),
];

/// A spelled name that does not collide with a reserved word of the language.
pub fn avoid_reserved(spelled: String, language: &str) -> String {
    let lower = spelled.to_lowercase();
    let reserved = RESERVED_WORDS
        .iter()
        .any(|(id, words)| *id == language && words.split(' ').any(|word| word == lower));
    if reserved {
        format!("{spelled}_")
    } else {
        spelled
    }
}
