//! Source type spellings shared by formal grammars.

use regex::Regex;
use std::sync::OnceLock;

/// Map a source type spelling to a meta type: integer, text, boolean,
/// nothing, `source:<spelling>` for other types, or `None` when the source
/// leaves the type to inference.
pub fn source_type(spelling: &str) -> Option<String> {
    static QUALIFIERS: OnceLock<Regex> = OnceLock::new();
    let qualifiers = QUALIFIERS.get_or_init(|| {
        Regex::new(r"\b(const|static|unsigned|signed|mut)\b").expect("valid pattern")
    });
    let stripped = qualifiers.replace_all(spelling, "");
    let words = stripped.split_whitespace().collect::<Vec<_>>().join(" ");
    let meta = match words.as_str() {
        "int" | "long" | "short" | "i8" | "i16" | "i32" | "i64" | "isize" | "u8" | "u16"
        | "u32" | "u64" | "usize" | "Int" | "Long" | "number" | "integer" => "integer",
        "string" | "String" | "&'static str" => "text",
        _ if is_spaced_variant(&words) => "text",
        _ if array_pattern().is_match(&words) => "array",
        "double" | "float" | "f32" | "f64" | "float32" | "float64" | "Double" | "Float"
        | "Float64" | "Long_Float" | "real" | "Real" => "real",
        "bool" | "boolean" | "Bool" | "Boolean" | "BOOL" => "boolean",
        "void" | "()" | "Unit" | "Void" => "nothing",
        "" | "var" | "auto" => return None,
        _ => return Some(format!("source:{words}")),
    };
    Some(meta.to_owned())
}

/// The spellings of an array of integers: `int[]`, `std::vector<int>`,
/// `Vec<i64>`, `IntArray`, `[]int`, `[Int]`, `List<Long>`, `Array[Long]`,
/// `seq[int]` and `[n]i64`.
fn array_pattern() -> &'static Regex {
    static ARRAY: OnceLock<Regex> = OnceLock::new();
    ARRAY.get_or_init(|| {
        Regex::new(
            r"^((int|long|Long|number|i64) ?\[ ?\]|std ?:: ?vector ?< ?int ?>|Vec ?< ?i64 ?>|IntArray|\[ ?\] ?int|\[ ?Int ?\]|List ?< ?(int|Long) ?>|Array ?\[ ?Long ?\]|seq ?\[ ?int ?\]|\[ ?(\d+ ?)?\] ?i64)$",
        )
        .expect("valid pattern")
    })
}

/// Whether `words` spells `char *`, `std::string` or `&str` with at most one
/// space at each place the type pattern allows one.
fn is_spaced_variant(words: &str) -> bool {
    [
        "char*",
        "char *",
        "std::string",
        "std ::string",
        "std:: string",
        "std :: string",
        "&str",
        "& str",
    ]
    .contains(&words)
}
