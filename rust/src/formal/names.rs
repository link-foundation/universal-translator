//! Identifier naming. The meta language stores each name the program
//! declares as neutral lower-case words joined by "-" (for example
//! "greatest-common-divisor"); every language description states how it
//! spells such words. Names the program does not declare (library
//! procedures) are left exactly as written.

use std::collections::HashSet;
use std::sync::OnceLock;

use regex::Regex;

use super::languages::{Convention, Role};
use crate::meta::{Node, rewrite, walk};

/// The words of an identifier: "greatestCommonDivisor",
/// "greatest_common_divisor" and "GreatestCommonDivisor" all become
/// `["greatest", "common", "divisor"]`. Letters of every script count:
/// "суммаКвадратов" is `["сумма", "квадратов"]`.
pub fn name_words(identifier: &str) -> Vec<String> {
    static BOUNDARIES: OnceLock<[Regex; 2]> = OnceLock::new();
    let [lower_then_capital, acronym_end] = BOUNDARIES.get_or_init(|| {
        [
            Regex::new(r"([\p{Ll}\p{N}])(\p{Lu})").expect("valid pattern"),
            Regex::new(r"(\p{Lu})(\p{Lu}\p{Ll})").expect("valid pattern"),
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
        Convention::Ada => words
            .iter()
            .map(|word| capitalize(word))
            .collect::<Vec<_>>()
            .join("_"),
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
            "Declaration" | "Catch" => "name",
            "CountingLoop" | "ForEach" => "variable",
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
        "Name" | "Declaration" | "Assignment" | "IndexAssignment" | "Catch" => {
            rename_field(current, "name")
        }
        "Call" => rename_field(current, "callee"),
        "CountingLoop" | "ForEach" => rename_field(current, "variable"),
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
        "objc",
        "auto break case char const continue default do double else enum extern float for goto if inline int long register restrict return short signed sizeof static struct switch typedef union unsigned void volatile while bool id self super nil yes no in out inout bycopy byref oneway main",
    ),
    (
        "nim",
        "addr and as asm bind block break case cast concept const continue converter defer discard distinct div do elif else end enum except export finally for from func if import in include interface is isnot iterator let macro method mixin mod nil not notin object of or out proc ptr raise ref return shl shr static template try tuple type using var when while xor yield echo result stdout int string bool true false",
    ),
    (
        "d",
        "abstract alias align asm assert auto body bool break byte case cast catch cdouble cent cfloat char class const continue creal dchar debug default delegate delete deprecated do double else enum export extern false final finally float for foreach foreach_reverse function goto idouble if ifloat immutable import in inout int interface invariant ireal is lazy long macro mixin module new nothrow null out override package pragma private protected public pure real ref return scope shared short static struct super switch synchronized template this throw true try typeid typeof ubyte ucent uint ulong union unittest ushort version void wchar while with text write writeln main",
    ),
    (
        "pascal",
        "and array asm begin break case const constructor continue destructor div do downto else end exit file for forward function goto if implementation in inherited inline interface label mod nil not object of on operator or packed procedure program record repeat result self set shl shr string then to type unit until uses var while with xor true false write writeln int64 boolean main",
    ),
    (
        "fortran",
        "allocatable call character contains do else end exit function if implicit integer intent logical mod module none print program recursive result return stop subroutine then use value while write main",
    ),
    (
        "ada",
        "abort abs abstract accept access aliased all and array at begin body case constant declare delay delta digits do else elsif end entry exception exit for function generic goto if in interface is limited loop mod new not null of or others out overriding package parallel pragma private procedure protected raise range record rem renames requeue return reverse select separate some subtype synchronized tagged task terminate then type until use when while with xor put put_line new_line long_io integer_io long_long_integer boolean string true false main",
    ),
    (
        "vb",
        "addhandler addressof alias and andalso as boolean byref byte byval call case catch cbool cbyte cchar cdate cdbl cdec char cint class clng cobj const continue csbyte cshort csng cstr ctype cuint culng cushort date decimal declare default delegate dim directcast do double each else elseif end endif enum erase error event exit false finally for friend function get gettype getxmlnamespace global gosub goto handles if implements imports in inherits integer interface is isnot let lib like long loop me mod module mustinherit mustoverride mybase myclass namespace narrowing new next not nothing notinheritable notoverridable object of on operator option optional or orelse overloads overridable overrides paramarray partial private property protected public raiseevent readonly redim rem removehandler resume return sbyte select set shadows shared short single static step stop string structure sub synclock then throw to true try trycast typeof uinteger ulong ushort using variant wend when while widening with withevents writeonly xor console vblf main program",
    ),
    (
        "matlab",
        "break case catch classdef continue disp else elseif end false fix for fprintf function global if otherwise parfor persistent rem result return source sprintf spmd switch true try while",
    ),
    (
        "zig",
        "addrspace align allowzero and anyframe anytype asm break callconv catch comptime const continue defer else enum errdefer error export extern false fn for if inline linksection noalias noinline nosuspend opaque or orelse packed pub resume return struct suspend switch test threadlocal true try undefined union unreachable usingnamespace var volatile while out buffer writer init std common_library main",
    ),
    (
        "lean",
        "abbrev at axiom by calc class deriving do else end example export extends false for from fun have if import in inductive instance let local macro match mut mutual namespace notation open partial private protected pure return section show structure syntax then theorem this true universe variable where while with default main commonlibrary",
    ),
    (
        "rocq",
        "as at cofix definition else end eval exists fix fixpoint for forall fun if in let load match mod module return set struct then type where with pure stop bind loop_while for_range print print_line line_end digits show value call run item with_item with_item_at filled size default outcome going returned action tt unit negb andb orb list nil cons string bool true false nat length commonlibrary common_library main no_arguments",
    ),
    (
        "gml",
        "all and array_create array_length begin break case catch constructor continue default delete depth direction div do else end enum exit false finally for friction function global globalvar gravity health hspeed id if image_index lives local mod new noone not or other persistent repeat return score self show_debug_message solid speed sprite_index static string switch then throw true try until var visible vspeed while with x xor y",
    ),
    (
        "bash",
        "case coproc dirname do done echo elif else esac fi for function if in local printf return select then time until while",
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
    // Ada names cannot end with an underscore.
    let suffix = if language == "ada" { "_Value" } else { "_" };
    if reserved {
        format!("{spelled}{suffix}")
    } else {
        spelled
    }
}

/// Languages whose names are ASCII letters, digits and underscores only (or
/// whose compilers accept other letters only with extra flags). A name in
/// another script is transliterated for them; what has no transliteration
/// is written as its code point ("u4e16").
const ASCII_ONLY: [&str; 14] = [
    "ada", "bash", "c", "cpp", "dart", "fortran", "gml", "lua", "matlab", "objc", "pascal", "perl",
    "r", "zig",
];

/// Whether a language (or a machine target) takes ASCII names only.
pub fn ascii_names(language: &str, machine: bool) -> bool {
    machine || ASCII_ONLY.contains(&language)
}

/// Each letter and its Latin spelling, lower case.
const LATIN_PAIRS: &str = "а a б b в v г g д d е e ё e ж zh з z и i й y к k л l м m н n о o п p \
    р r с s т t у u ф f х kh ц ts ч ch ш sh щ shch ъ _ ы y ь _ э e ю yu \
    я ya і i ї yi є ye ґ g ў u α a β b γ g δ d ε e ζ z η i θ th ι i κ k \
    λ l μ m ν n ξ x ο o π p ρ r σ s ς s τ t υ y φ f χ ch ψ ps ω o ß ss \
    æ ae œ oe ø o å a ł l đ d ð d þ th ı i";

/// Latin letters with marks and the letters without them.
const MARKED: &str = "àáâãäåçèéêëìíîïñòóôõöùúûüýÿāăąćĉċčďēĕėęěĝğġģĥĩīĭįĵķĺļľńņňōŏőŕŗřśŝşšţťũūŭůűųŵŷźżžơưǎǐǒǔǖǘǚǜǟǡǧǩǫǭǰǵǹǻȁȃȅȇȉȋȍȏȑȓȕȗșțȟȧȩȫȭȯȱȳ";
const UNMARKED: &str = "aaaaaaceeeeiiiinooooouuuuyyaaaccccdeeeeegggghiiiijklllnnnooorrrssssttuuuuuuwyzzzouaiouuuuuaagkoojgnaaaeeiioorruusthaeooooy";

fn latin_table() -> &'static std::collections::HashMap<String, String> {
    static TABLE: OnceLock<std::collections::HashMap<String, String>> = OnceLock::new();
    TABLE.get_or_init(|| {
        let words: Vec<&str> = LATIN_PAIRS.split_whitespace().collect();
        let mut table: std::collections::HashMap<String, String> = words
            .chunks(2)
            .map(|pair| {
                let spelled = if pair[1] == "_" { "" } else { pair[1] };
                (pair[0].to_owned(), spelled.to_owned())
            })
            .collect();
        for (letter, plain) in MARKED.chars().zip(UNMARKED.chars()) {
            table.insert(letter.to_string(), plain.to_string());
        }
        table
    })
}

fn latin_letter(letter: char) -> String {
    let lower: String = letter.to_lowercase().collect();
    let spelled = latin_table()
        .get(&lower)
        .cloned()
        .unwrap_or_else(|| lower.clone());
    if !spelled
        .chars()
        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_')
    {
        return format!("u{:x}", letter as u32);
    }
    if letter.to_string() == lower {
        spelled
    } else {
        capitalize(&spelled)
    }
}

/// A spelled name in the letters a language accepts.
pub fn ascii_name(spelled: String, language: &str, machine: bool) -> String {
    if !ascii_names(language, machine) || spelled.is_ascii() {
        return spelled;
    }
    spelled
        .chars()
        .map(|letter| {
            if letter.is_ascii() {
                letter.to_string()
            } else {
                latin_letter(letter)
            }
        })
        .collect()
}
