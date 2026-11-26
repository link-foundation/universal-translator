//! Issue #14: identifier languages. The names a program declares are
//! translated to another natural language, through the meta program or, when
//! the programming language stays, in place. The JavaScript twin is
//! js/tests/identifiers.test.js.

use std::collections::HashMap;
use std::io::Write;
use std::process::{Command, Stdio};

use universal_translator::formal::names::{ascii_name, name_words};
use universal_translator::{Options, Translator};

const SOURCE: &str = "// Sum of squares
function sumOfSquares(numbers) {
  let total = 0;
  for (let index = 0; index < numbers.length; index++) {
    total += numbers[index] * numbers[index];
  }
  return total;
}
console.log(sumOfSquares([1, 2, 3]));
";

/// A fixed dictionary, so the tests do not depend on the vocabulary.
fn stub() -> Translator {
    let words: HashMap<&str, &str> = [
        ("sum", "сумма"),
        ("of", ""),
        ("squares", "квадратов"),
        ("numbers", "числа"),
        ("total", "итог"),
        ("index", "индекс"),
    ]
    .into_iter()
    .collect();
    Translator::new().with_comment_translator(move |text, _, _| {
        Ok(text
            .split(' ')
            .map(|word| {
                words
                    .get(word.to_lowercase().as_str())
                    .map_or(word.to_owned(), |known| (*known).to_owned())
            })
            .collect::<Vec<_>>()
            .join(" "))
    })
}

fn russian() -> Options {
    Options::default()
        .with_identifier_language("russian", None)
        .expect("an identifier language")
}

fn translated(translator: &Translator, source: &str, to: &str, options: Options) -> String {
    translator
        .translate_with(source, "javascript", to, options)
        .expect("a translation")
}

#[test]
fn renames_the_declared_names_in_place_keeping_every_other_character() {
    let expected = SOURCE
        .replace("sumOfSquares", "суммаКвадратов")
        .replace("numbers", "числа")
        .replace("total", "итог")
        .replace("index", "индекс");
    let output = translated(&stub(), SOURCE, "javascript", russian());
    assert_eq!(output, expected);
    assert!(output.contains("console.log(суммаКвадратов"));
    assert!(output.contains(".length"));
}

#[test]
fn spells_translated_names_in_the_convention_of_the_target() {
    let output = translated(&stub(), SOURCE, "python", russian());
    assert!(output.contains("def сумма_квадратов(числа):"), "{output}");
    assert!(
        output.contains("print(сумма_квадратов([1, 2, 3]))"),
        "{output}"
    );
}

#[test]
fn transliterates_names_for_languages_with_ascii_names_only() {
    let output = translated(&stub(), SOURCE, "c", russian());
    assert!(output.contains("summa_kvadratov("), "{output}");
    assert!(output.contains("int itog = 0;"), "{output}");
}

#[test]
fn translates_the_comments_and_the_names_together() {
    let options = russian()
        .with_comment_language("russian", None)
        .expect("a comment language");
    let output = translated(&stub(), SOURCE, "javascript", options);
    assert_eq!(output.lines().next(), Some("// сумма  квадратов"));
    assert!(output.contains("function суммаКвадратов(числа) {"));
}

/// The names are taken in sorted order: "sum" gets the translation first.
#[test]
fn never_makes_two_names_one() {
    let translator = Translator::new().with_comment_translator(|_, _, _| Ok("итог".to_owned()));
    let twins = "let total = 1;\nlet sum = 2;\nconsole.log(total + sum);\n";
    assert_eq!(
        translated(&translator, twins, "javascript", russian()),
        "let total = 1;\nlet итог = 2;\nconsole.log(total + итог);\n"
    );
}

#[test]
fn renames_names_inside_interpolated_texts_through_the_meta_program() {
    let quoted = "let total = 1;\nconsole.log(`${total}`);\n";
    let output = translated(&stub(), quoted, "javascript", russian());
    assert!(output.contains("итог"), "{output}");
    assert!(!output.contains("total"), "{output}");
}

#[test]
fn reads_names_written_in_other_scripts() {
    let cyrillic = "let итог = 1;\nconsole.log(итог);\n";
    assert_eq!(
        translated(&Translator::new(), cyrillic, "python", Options::default()),
        "итог = 1\nprint(итог)\n"
    );
    assert_eq!(name_words("суммаКвадратов"), ["сумма", "квадратов"]);
    assert_eq!(ascii_name("größeÉtat".to_owned(), "c", false), "grosseEtat");
    assert_eq!(ascii_name("世".to_owned(), "c", false), "u4e16");
    assert_eq!(ascii_name("итог".to_owned(), "python", false), "итог");
}

#[test]
fn refuses_identifier_languages_that_do_not_exist() {
    assert!(
        Options::default()
            .with_identifier_language("klingon", None)
            .is_err()
    );
}

#[test]
fn is_an_option_of_the_command_line() {
    let mut child = Command::new(env!("CARGO_BIN_EXE_universal-translator"))
        .args([
            "translate",
            "javascript",
            "python",
            "-",
            "--identifier-language",
            "russian",
            "--identifier-from",
            "english",
        ])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("the command line");
    child
        .stdin
        .take()
        .expect("standard input")
        .write_all(b"let total = 1;\nconsole.log(total);\n")
        .expect("the input");
    let output = child.wait_with_output().expect("the output");
    assert_eq!(output.status.code(), Some(0));
    let text = String::from_utf8(output.stdout).expect("UTF-8 output");
    assert!(!text.contains("total"), "{text}");
}
