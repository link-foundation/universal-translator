//! Surface syntax descriptions for the grammar-based translator.
//!
//! Each description is plain data. The lexer, parser and emitter read these
//! tables, so supporting another language (or a project-specific dialect)
//! means describing it here.

pub use super::machine_languages::MACHINE_TARGETS;
use super::more_languages::MORE_LANGUAGES;
use super::rocq_runtime::ROCQ_RUNTIME;
use super::versions::{split_version, with_version};
use crate::meta::GrammarError;

/// How a language spells the neutral words of a declared name.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Convention {
    Camel,
    Pascal,
    Snake,
    /// Capitalized words joined by underscores, as Ada writes `Is_Prime`.
    Ada,
}

/// Naming conventions per role: functions and variables.
#[derive(Clone, Copy, Debug)]
pub struct Naming {
    pub function: Convention,
    pub variable: Convention,
}

pub(super) const fn same(convention: Convention) -> Naming {
    Naming {
        function: convention,
        variable: convention,
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Blocks {
    Braces,
    Indentation,
    End,
    /// Keyword-delimited blocks laid out by a dialect, such as Pascal's
    /// `begin ... end` or Fortran's `if ... end if`.
    Keywords,
}

/// Where a language writes types, if at all.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Typed {
    No,
    Annotation,
    Prefix,
    Suffix,
}

/// How a language announces a function that is called before its definition.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ForwardDeclarations {
    /// Functions may be called before their definition.
    None,
    /// `int male(int index);`
    Prototype,
    /// `local male`, with the definition written without `local`.
    Local,
    /// The function heading alone, such as Nim's `proc male(index: int): int`.
    Heading,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum EntryPoint {
    TopLevel,
    MainFunction,
    ClassMethod,
}

/// Operator spellings that differ from the common symbols.
#[derive(Clone, Copy, Debug)]
pub struct Operators {
    pub and: &'static str,
    pub or: &'static str,
    pub not: &'static str,
    pub not_equal: &'static str,
    pub equal: Option<&'static str>,
    pub integer_divide: Option<&'static str>,
    pub concatenate: Option<&'static str>,
    /// An extra spelling of the remainder operator, such as R's `%%`.
    pub remainder: Option<&'static str>,
}

/// Spellings of the meta types integer, text, boolean and nothing.
#[derive(Clone, Copy, Debug)]
pub struct Types {
    pub integer: &'static str,
    pub text: &'static str,
    pub boolean: &'static str,
    pub nothing: &'static str,
}

/// How embedded expressions are written inside a text literal.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum InterpolationStyle {
    Plain,
    Braces,
    DollarBraces,
    HashBraces,
    Dollar,
    DollarDoubled,
    DollarParentheses,
    BackslashParentheses,
}

/// A kind of text literal that embeds expressions: the quote it uses (any
/// quote when `None`), the prefix that marks it, such as Python's `f`, and
/// the style of its embeddings.
#[derive(Clone, Copy, Debug)]
pub struct Interpolation {
    pub quote: Option<char>,
    pub prefix: Option<&'static str>,
    pub style: InterpolationStyle,
}

pub(super) const fn embeds(quote: char, style: InterpolationStyle) -> Interpolation {
    Interpolation {
        quote: Some(quote),
        prefix: None,
        style,
    }
}

/// How a language without an integer division operator divides integers:
/// a wrapper around `/` such as `Math.trunc(a / b)`, a call such as
/// `div(a, b)` or a method such as `a.intdiv(b)`.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum IntegerDivision {
    Wrapper(&'static str),
    Call(&'static str),
    Method(&'static str),
}

/// What a target does with a parameter that its function reassigns.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ImmutableParameters {
    /// Parameters can be reassigned.
    No,
    /// A mutable local of the same name copies the parameter.
    Copied,
    /// The parameter is renamed and a local with its name copies it.
    Renamed,
}

/// The output procedures of a language: those that end the line and those
/// that write text as it is.
#[derive(Clone, Copy, Debug)]
pub struct PrintCalls {
    pub line: &'static [&'static str],
    pub text: &'static [&'static str],
    /// Whether the line procedure prints its arguments one after another,
    /// without spaces, as D's `writeln` does.
    pub adjacent: bool,
}

/// What a language calls a call and a routine, used to adapt comments.
#[derive(Clone, Copy, Debug)]
pub struct Terms {
    pub call: &'static str,
    pub routine: &'static str,
}

#[derive(Clone, Debug)]
pub struct Syntax {
    pub id: &'static str,
    pub label: &'static str,
    pub naming: Naming,
    pub immutable_parameters: ImmutableParameters,
    pub blocks: Blocks,
    pub line_comment: &'static str,
    pub block_comment: Option<(&'static str, &'static str)>,
    pub nested_comments: bool,
    pub comment_strings: bool,
    pub quotes: &'static [char],
    pub interpolation: &'static [Interpolation],
    /// Characters escaped in plain text because they start an embedding.
    pub escape_sigils: &'static [&'static str],
    /// Symbols the language adds to the common ones, such as R's `<-`.
    pub symbols: &'static [&'static str],
    /// The suffix of integer literals, such as R's `1L`.
    pub number_suffix: Option<&'static str>,
    /// The suffix that makes a literal a long integer, such as Scala's `1L`.
    pub long_suffix: Option<&'static str>,
    pub declarations: &'static [&'static str],
    pub variable_sigil: Option<char>,
    pub function_keyword: Option<&'static str>,
    /// Whether functions are values assigned to a name: `f <- function(x)`.
    pub assigned_functions: bool,
    /// The assignment symbol where it is not `=`.
    pub assignment: Option<&'static str>,
    /// Whether `x += 1` exists.
    pub compound_assignment: bool,
    /// Whether a function unpacks its arguments from `@_`, as Perl does.
    pub unpacked_parameters: bool,
    /// Which calls may leave out their parentheses: `puts "Hello"`.
    pub command_calls: CommandCalls,
    /// Calls that convert a value to text, such as Python's `str`. Printing
    /// and joining text already convert, so reading drops them there.
    pub text_conversions: &'static [&'static str],
    /// Whether text with computed parts is joined with `+` and the
    /// conversion call instead of interpolated (Python 2).
    pub text_join_concatenation: bool,
    /// Whether print is a statement: `print x` (Python 2).
    pub print_statement: bool,
    /// The word that declares every variable and loop counter where the
    /// language has older and newer ones (`var` in ECMAScript 5).
    pub declaration_keyword: Option<&'static str>,
    /// The version of the language the description is for, such as "2" for
    /// `python@2` (none for the default version).
    pub version: Option<&'static str>,
    /// The symbol between a function head and its body, such as Scala's `=`.
    pub body_after: Option<&'static str>,
    pub operators: Operators,
    pub integer_division: Option<IntegerDivision>,
    /// A call that joins text, such as R's `paste0`.
    pub concatenate_call: Option<&'static str>,
    /// Spellings of `true` and `false` where they differ.
    pub words: Option<(&'static str, &'static str)>,
    pub else_if: Option<&'static str>,
    /// The word after `}` that continues an if chain, where it is not
    /// `else if`.
    pub braced_else_if: Option<&'static str>,
    /// The word or symbol between a loop variable and its range, where it is
    /// not `in`.
    pub for_in: Option<&'static str>,
    pub print_line: &'static str,
    pub print_calls: Option<PrintCalls>,
    /// Lines that start every program.
    pub prelude: &'static [&'static str],
    pub entry_point: EntryPoint,
    pub main_name: Option<&'static str>,
    pub header: Option<&'static str>,
    /// What wraps a class-method entry point, such as `object Main`.
    pub container: Option<&'static str>,
    /// The statement that runs a main function the language does not call
    /// itself.
    pub call_main: Option<&'static str>,
    pub typed: Typed,
    pub types: Option<Types>,
    pub return_arrow: Option<&'static str>,
    pub terms: Terms,
    /// Whether this is a lowering target written from stack machine code.
    pub machine: bool,
    /// How a function called before its definition is announced.
    pub forward_declarations: ForwardDeclarations,
    /// The language whose tables a dialect is written with, such as C for
    /// Objective-C.
    pub family: Option<&'static str>,
    /// Whether keywords and names ignore letter case (Pascal, Fortran, Ada).
    pub case_insensitive: bool,
    /// Whether a quote inside text is written twice, with no backslash
    /// escapes (Pascal, Fortran, Ada, Visual Basic, MATLAB).
    pub doubled_quotes: bool,
    /// The statement of an empty indented block, where it is not `pass`.
    pub empty_statement: Option<&'static str>,
    /// The index of the first element of an array: 0, or 1 in Lua, Julia,
    /// R, Fortran and MATLAB.
    pub array_base: i64,
    /// How a language without a filled array constructor writes one (see
    /// `expand_array_fills` in arrays.rs).
    pub array_fill: Option<ArrayFill>,
    /// How a language writes a loop over the elements of an array, with
    /// `{type}`, `{variable}`, `{array}` and `{array-name}` as the holes; the
    /// others write a counting loop (see `expand_for_each` in for_each.rs).
    pub for_each: Option<&'static str>,
}

/// Which calls may be written without parentheses.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CommandCalls {
    No,
    /// Any call: Ruby's `puts "Hello"`.
    Any,
    /// Only the named calls, which may also have no values: Python 2's
    /// `print x` and a bare `print`.
    Only(&'static [&'static str]),
}

/// How an array of `n` equal values is written where no constructor fills
/// one: the array is created and a counting loop fills it.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ArrayFill {
    /// The new array holds no values yet (C's variable-length arrays).
    Always,
    /// The new array starts with zeros, so a fill of 0 needs no loop.
    NonZero,
    /// The array starts empty and grows as the loop fills it.
    Empty,
}

impl Syntax {
    /// The spelling of a meta operator that this language writes its own way.
    pub fn operator(&self, meta: &str) -> Option<&'static str> {
        let operators = &self.operators;
        match meta {
            "and" => Some(operators.and),
            "or" => Some(operators.or),
            "not" => Some(operators.not),
            "notEqual" => Some(operators.not_equal),
            "equal" => operators.equal,
            "integerDivide" => operators.integer_divide,
            "concatenate" => operators.concatenate,
            "remainder" => operators.remainder,
            _ => None,
        }
    }

    /// How this language spells a declared name with the given role.
    pub fn naming_convention(&self, role: Role) -> Convention {
        match role {
            Role::Function => self.naming.function,
            Role::Variable => self.naming.variable,
        }
    }

    pub fn is_typed(&self) -> bool {
        self.typed != Typed::No
    }
}

/// The role of a declared name.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Role {
    Function,
    Variable,
}

pub(super) const BRACE_OPERATORS: Operators = Operators {
    and: "&&",
    or: "||",
    not: "!",
    not_equal: "!=",
    equal: None,
    integer_divide: None,
    concatenate: None,
    remainder: None,
};

pub(super) const SCRIPT_OPERATORS: Operators = Operators {
    equal: Some("==="),
    not_equal: "!==",
    ..BRACE_OPERATORS
};

pub(super) const WORD_OPERATORS: Operators = Operators {
    and: "and",
    or: "or",
    not: "not",
    not_equal: "!=",
    equal: None,
    integer_divide: Some("//"),
    concatenate: None,
    remainder: None,
};

pub(super) const INTEGER_TYPES: Types = Types {
    integer: "int",
    text: "string",
    boolean: "bool",
    nothing: "void",
};

pub(super) const C_QUOTES: &[char] = &['"'];
pub(super) const SCRIPT_QUOTES: &[char] = &['"', '\'', '`'];
pub(super) const BOTH_QUOTES: &[char] = &['"', '\''];
pub(super) const SLASH_COMMENTS: Option<(&str, &str)> = Some(("/*", "*/"));
pub(super) const FUNCTION_TERMS: Terms = Terms {
    call: "function call",
    routine: "function",
};
pub(super) const METHOD_TERMS: Terms = Terms {
    call: "method call",
    routine: "method",
};

pub(super) const SCRIPT_DIVISION: Option<IntegerDivision> =
    Some(IntegerDivision::Wrapper("Math.trunc"));

/// The JavaScript description; the others start from it and change fields.
pub(super) const JAVASCRIPT: Syntax = Syntax {
    id: "javascript",
    for_each: Some("for (const {variable} of {array})"),
    label: "JavaScript",
    naming: same(Convention::Camel),
    immutable_parameters: ImmutableParameters::No,
    blocks: Blocks::Braces,
    line_comment: "//",
    block_comment: SLASH_COMMENTS,
    nested_comments: false,
    comment_strings: false,
    quotes: SCRIPT_QUOTES,
    interpolation: &[embeds('`', InterpolationStyle::DollarBraces)],
    escape_sigils: &[],
    symbols: &[],
    number_suffix: None,
    long_suffix: None,
    declarations: &["let", "const", "var"],
    variable_sigil: None,
    function_keyword: Some("function"),
    assigned_functions: false,
    assignment: None,
    compound_assignment: true,
    unpacked_parameters: false,
    command_calls: CommandCalls::No,
    text_conversions: &[],
    text_join_concatenation: false,
    print_statement: false,
    declaration_keyword: None,
    version: None,
    body_after: None,
    operators: SCRIPT_OPERATORS,
    // Every other language starts from this description, so the JavaScript
    // spelling of integer division is set on the JavaScript entries only.
    integer_division: None,
    concatenate_call: None,
    words: None,
    else_if: None,
    braced_else_if: None,
    for_in: None,
    print_line: "console.log",
    print_calls: None,
    prelude: &[],
    entry_point: EntryPoint::TopLevel,
    main_name: None,
    header: None,
    container: None,
    call_main: None,
    typed: Typed::No,
    types: None,
    return_arrow: None,
    terms: FUNCTION_TERMS,
    machine: false,
    forward_declarations: ForwardDeclarations::None,
    family: None,
    case_insensitive: false,
    doubled_quotes: false,
    empty_statement: None,
    array_base: 0,
    array_fill: None,
};

/// The C description, the base of the other prefix-typed languages.
pub(super) const C: Syntax = Syntax {
    id: "c",
    for_each: None,
    label: "C",
    naming: same(Convention::Snake),
    quotes: C_QUOTES,
    interpolation: &[],
    declarations: &[],
    function_keyword: None,
    operators: BRACE_OPERATORS,
    print_line: "printf",
    entry_point: EntryPoint::MainFunction,
    typed: Typed::Prefix,
    types: Some(Types {
        text: "const char *",
        ..INTEGER_TYPES
    }),
    // A call to a function defined later needs a prototype.
    forward_declarations: ForwardDeclarations::Prototype,
    ..JAVASCRIPT
};

/// Every language the grammar translator describes, in listing order.
pub static LANGUAGES: [Syntax; 32] = [
    Syntax {
        integer_division: SCRIPT_DIVISION,
        // ECMAScript 5 truncates with ~~(a / b).
        symbols: &["~"],
        text_conversions: &["String"],
        ..JAVASCRIPT
    },
    Syntax {
        id: "typescript",
        for_each: Some("for (const {variable} of {array})"),
        integer_division: SCRIPT_DIVISION,
        text_conversions: &["String"],
        label: "TypeScript",
        typed: Typed::Annotation,
        types: Some(Types {
            integer: "number",
            text: "string",
            boolean: "boolean",
            nothing: "void",
        }),
        return_arrow: Some(":"),
        ..JAVASCRIPT
    },
    Syntax {
        id: "python",
        for_each: Some("for {variable} in {array}"),
        label: "Python",
        naming: same(Convention::Snake),
        blocks: Blocks::Indentation,
        line_comment: "#",
        block_comment: None,
        quotes: BOTH_QUOTES,
        interpolation: &[Interpolation {
            quote: None,
            prefix: Some("f"),
            style: InterpolationStyle::Braces,
        }],
        declarations: &[],
        function_keyword: Some("def"),
        operators: WORD_OPERATORS,
        words: Some(("True", "False")),
        print_line: "print",
        // Python 2 prints with a statement: `print x`, a bare `print`.
        command_calls: CommandCalls::Only(&["print"]),
        text_conversions: &["str"],
        ..JAVASCRIPT
    },
    Syntax {
        id: "ruby",
        for_each: Some("for {variable} in {array}"),
        label: "Ruby",
        naming: same(Convention::Snake),
        blocks: Blocks::End,
        line_comment: "#",
        block_comment: None,
        quotes: BOTH_QUOTES,
        interpolation: &[embeds('"', InterpolationStyle::HashBraces)],
        declarations: &[],
        function_keyword: Some("def"),
        command_calls: CommandCalls::Any,
        operators: BRACE_OPERATORS,
        else_if: Some("elsif"),
        print_line: "puts",
        terms: METHOD_TERMS,
        ..JAVASCRIPT
    },
    Syntax {
        id: "lua",
        for_each: Some("for _, {variable} in ipairs({array}) do"),
        array_fill: Some(ArrayFill::Empty),
        array_base: 1,
        label: "Lua",
        naming: same(Convention::Snake),
        blocks: Blocks::End,
        line_comment: "--",
        block_comment: None,
        quotes: BOTH_QUOTES,
        interpolation: &[],
        declarations: &["local"],
        compound_assignment: false,
        operators: Operators {
            not_equal: "~=",
            ..WORD_OPERATORS
        },
        else_if: Some("elseif"),
        print_line: "print",
        // A local function called before its definition is declared first.
        forward_declarations: ForwardDeclarations::Local,
        ..JAVASCRIPT
    },
    Syntax {
        id: "php",
        for_each: Some("foreach ({array} as {variable})"),
        label: "PHP",
        integer_division: Some(IntegerDivision::Call("intdiv")),
        quotes: BOTH_QUOTES,
        interpolation: &[embeds('"', InterpolationStyle::Dollar)],
        escape_sigils: &["$"],
        declarations: &[],
        variable_sigil: Some('$'),
        operators: Operators {
            concatenate: Some("."),
            ..SCRIPT_OPERATORS
        },
        else_if: Some("elseif"),
        print_line: "echo",
        header: Some("<?php"),
        ..JAVASCRIPT
    },
    Syntax {
        array_fill: Some(ArrayFill::Always),
        ..C
    },
    Syntax {
        id: "cpp",
        for_each: Some("for ({type} {variable} : {array})"),
        label: "C++",
        print_line: "std::cout",
        types: Some(Types {
            text: "std::string",
            ..INTEGER_TYPES
        }),
        ..C
    },
    Syntax {
        id: "csharp",
        for_each: Some("foreach ({type} {variable} in {array})"),
        array_fill: Some(ArrayFill::NonZero),
        label: "C#",
        naming: Naming {
            function: Convention::Pascal,
            variable: Convention::Camel,
        },
        interpolation: &[Interpolation {
            quote: Some('"'),
            prefix: Some("$"),
            style: InterpolationStyle::Braces,
        }],
        // C# 5 converts the computed parts of a joined text; every version
        // reads them back as the parts.
        text_conversions: &["System.Convert.ToString"],
        declarations: &["var"],
        print_line: "System.Console.WriteLine",
        entry_point: EntryPoint::ClassMethod,
        main_name: Some("Main"),
        types: Some(INTEGER_TYPES),
        terms: METHOD_TERMS,
        forward_declarations: ForwardDeclarations::None,
        ..C
    },
    Syntax {
        id: "java",
        for_each: Some("for ({type} {variable} : {array})"),
        array_fill: Some(ArrayFill::NonZero),
        label: "Java",
        naming: same(Convention::Camel),
        declarations: &["var"],
        print_line: "System.out.println",
        entry_point: EntryPoint::ClassMethod,
        main_name: Some("main"),
        types: Some(Types {
            text: "String",
            boolean: "boolean",
            ..INTEGER_TYPES
        }),
        terms: METHOD_TERMS,
        forward_declarations: ForwardDeclarations::None,
        ..C
    },
    Syntax {
        id: "go",
        for_each: Some("for _, {variable} := range {array}"),
        array_fill: Some(ArrayFill::NonZero),
        label: "Go",
        naming: same(Convention::Camel),
        declarations: &["var"],
        function_keyword: Some("func"),
        print_line: "fmt.Println",
        typed: Typed::Suffix,
        types: Some(Types {
            nothing: "",
            ..INTEGER_TYPES
        }),
        forward_declarations: ForwardDeclarations::None,
        ..C
    },
    Syntax {
        id: "rust",
        nested_comments: true,
        for_each: Some("for &{variable} in &{array}"),
        label: "Rust",
        immutable_parameters: ImmutableParameters::Copied,
        declarations: &["let"],
        function_keyword: Some("fn"),
        print_line: "println!",
        typed: Typed::Annotation,
        types: Some(Types {
            integer: "i64",
            text: "&str",
            boolean: "bool",
            nothing: "()",
        }),
        return_arrow: Some("->"),
        terms: Terms {
            call: "macro call",
            routine: "function",
        },
        forward_declarations: ForwardDeclarations::None,
        ..C
    },
    Syntax {
        id: "kotlin",
        nested_comments: true,
        for_each: Some("for ({variable} in {array})"),
        label: "Kotlin",
        naming: same(Convention::Camel),
        immutable_parameters: ImmutableParameters::Copied,
        interpolation: &[embeds('"', InterpolationStyle::Dollar)],
        escape_sigils: &["$"],
        declarations: &["var", "val"],
        function_keyword: Some("fun"),
        print_line: "println",
        entry_point: EntryPoint::MainFunction,
        typed: Typed::Annotation,
        types: Some(Types {
            integer: "Int",
            text: "String",
            boolean: "Boolean",
            nothing: "Unit",
        }),
        return_arrow: Some(":"),
        forward_declarations: ForwardDeclarations::None,
        ..C
    },
    Syntax {
        id: "swift",
        nested_comments: true,
        for_each: Some("for {variable} in {array}"),
        label: "Swift",
        naming: same(Convention::Camel),
        immutable_parameters: ImmutableParameters::Copied,
        interpolation: &[embeds('"', InterpolationStyle::BackslashParentheses)],
        declarations: &["var", "let"],
        function_keyword: Some("func"),
        print_line: "print",
        entry_point: EntryPoint::TopLevel,
        typed: Typed::Annotation,
        types: Some(Types {
            integer: "Int",
            text: "String",
            boolean: "Bool",
            nothing: "Void",
        }),
        return_arrow: Some("->"),
        forward_declarations: ForwardDeclarations::None,
        ..C
    },
    Syntax {
        id: "perl",
        for_each: Some("for my {variable} (@{array-name})"),
        label: "Perl",
        naming: same(Convention::Snake),
        line_comment: "#",
        block_comment: None,
        quotes: BOTH_QUOTES,
        interpolation: &[embeds('"', InterpolationStyle::Dollar)],
        escape_sigils: &["$", "@"],
        declarations: &["my"],
        variable_sigil: Some('$'),
        function_keyword: Some("sub"),
        unpacked_parameters: true,
        command_calls: CommandCalls::Any,
        operators: Operators {
            concatenate: Some("."),
            ..BRACE_OPERATORS
        },
        integer_division: Some(IntegerDivision::Wrapper("int")),
        else_if: Some("elsif"),
        braced_else_if: Some("elsif"),
        for_in: Some("("),
        print_calls: Some(PrintCalls {
            line: &["say"],
            text: &["print"],
            adjacent: false,
        }),
        words: Some(("1", "0")),
        prelude: &["use strict;", "use warnings;"],
        terms: Terms {
            call: "subroutine call",
            routine: "subroutine",
        },
        ..JAVASCRIPT
    },
    Syntax {
        id: "dart",
        nested_comments: true,
        for_each: Some("for (final {variable} in {array})"),
        label: "Dart",
        naming: same(Convention::Camel),
        quotes: BOTH_QUOTES,
        interpolation: &[
            embeds('"', InterpolationStyle::Dollar),
            embeds('\'', InterpolationStyle::Dollar),
        ],
        escape_sigils: &["$"],
        declarations: &["var", "final"],
        symbols: &["~/"],
        function_keyword: None,
        operators: Operators {
            integer_divide: Some("~/"),
            ..BRACE_OPERATORS
        },
        print_calls: Some(PrintCalls {
            line: &["print"],
            text: &["stdout.write"],
            adjacent: false,
        }),
        entry_point: EntryPoint::MainFunction,
        typed: Typed::Prefix,
        types: Some(Types {
            text: "String",
            ..INTEGER_TYPES
        }),
        ..JAVASCRIPT
    },
    Syntax {
        id: "scala",
        nested_comments: true,
        for_each: Some("for ({variable} <- {array})"),
        label: "Scala",
        naming: same(Convention::Camel),
        immutable_parameters: ImmutableParameters::Renamed,
        long_suffix: Some("L"),
        quotes: C_QUOTES,
        interpolation: &[Interpolation {
            quote: Some('"'),
            prefix: Some("s"),
            style: InterpolationStyle::DollarDoubled,
        }],
        declarations: &["var", "val"],
        function_keyword: Some("def"),
        body_after: Some("="),
        symbols: &["<-"],
        for_in: Some("<-"),
        operators: BRACE_OPERATORS,
        print_calls: Some(PrintCalls {
            line: &["println"],
            text: &["print"],
            adjacent: false,
        }),
        text_conversions: &["String.valueOf"],
        entry_point: EntryPoint::ClassMethod,
        container: Some("object Main"),
        typed: Typed::Annotation,
        types: Some(Types {
            integer: "Long",
            text: "String",
            boolean: "Boolean",
            nothing: "Unit",
        }),
        return_arrow: Some(":"),
        terms: METHOD_TERMS,
        ..JAVASCRIPT
    },
    Syntax {
        id: "julia",
        nested_comments: true,
        for_each: Some("for {variable} in {array}"),
        array_base: 1,
        label: "Julia",
        naming: same(Convention::Snake),
        blocks: Blocks::End,
        line_comment: "#",
        block_comment: Some(("#=", "=#")),
        quotes: C_QUOTES,
        interpolation: &[embeds('"', InterpolationStyle::DollarParentheses)],
        escape_sigils: &["$"],
        declarations: &[],
        operators: BRACE_OPERATORS,
        integer_division: Some(IntegerDivision::Call("div")),
        else_if: Some("elseif"),
        print_calls: Some(PrintCalls {
            line: &["println"],
            text: &["print"],
            adjacent: false,
        }),
        entry_point: EntryPoint::MainFunction,
        call_main: Some("main()"),
        ..JAVASCRIPT
    },
    Syntax {
        id: "r",
        for_each: Some("for ({variable} in {array})"),
        array_base: 1,
        label: "R",
        naming: same(Convention::Snake),
        line_comment: "#",
        block_comment: None,
        quotes: BOTH_QUOTES,
        interpolation: &[],
        declarations: &[],
        function_keyword: None,
        assigned_functions: true,
        assignment: Some("<-"),
        compound_assignment: false,
        number_suffix: Some("L"),
        symbols: &["<-", "%/%", "%%"],
        operators: Operators {
            remainder: Some("%%"),
            integer_divide: Some("%/%"),
            ..BRACE_OPERATORS
        },
        concatenate_call: Some("paste0"),
        print_calls: Some(PrintCalls {
            line: &[],
            text: &["cat"],
            adjacent: false,
        }),
        words: Some(("TRUE", "FALSE")),
        ..JAVASCRIPT
    },
    Syntax {
        id: "groovy",
        for_each: Some("for ({variable} in {array})"),
        label: "Groovy",
        naming: same(Convention::Camel),
        quotes: BOTH_QUOTES,
        interpolation: &[embeds('"', InterpolationStyle::Dollar)],
        escape_sigils: &["$"],
        declarations: &["def"],
        function_keyword: None,
        operators: BRACE_OPERATORS,
        integer_division: Some(IntegerDivision::Method("intdiv")),
        print_calls: Some(PrintCalls {
            line: &["println"],
            text: &["print"],
            adjacent: false,
        }),
        // println "Hello World"
        command_calls: CommandCalls::Only(&["println", "print"]),
        typed: Typed::Prefix,
        types: Some(Types {
            integer: "long",
            text: "String",
            boolean: "boolean",
            nothing: "void",
        }),
        terms: METHOD_TERMS,
        ..JAVASCRIPT
    },
    Syntax {
        id: "objc",
        array_fill: Some(ArrayFill::Always),
        label: "Objective-C",
        family: Some("c"),
        naming: same(Convention::Camel),
        words: Some(("YES", "NO")),
        types: Some(Types {
            text: "const char *",
            boolean: "BOOL",
            ..INTEGER_TYPES
        }),
        ..C
    },
    Syntax {
        id: "nim",
        nested_comments: true,
        for_each: Some("for {variable} in {array}"),
        label: "Nim",
        naming: same(Convention::Camel),
        // Parameters cannot be assigned; `var n = n` makes a mutable copy.
        immutable_parameters: ImmutableParameters::Copied,
        blocks: Blocks::Indentation,
        // A procedure body follows "=", other blocks follow ":".
        body_after: Some("="),
        // A procedure called before its definition needs its heading first.
        forward_declarations: ForwardDeclarations::Heading,
        empty_statement: Some("discard"),
        line_comment: "#",
        block_comment: Some(("#[", "]#")),
        quotes: C_QUOTES,
        interpolation: &[Interpolation {
            quote: Some('"'),
            prefix: Some("fmt"),
            style: InterpolationStyle::Braces,
        }],
        declarations: &["var", "let"],
        function_keyword: Some("proc"),
        operators: Operators {
            and: "and",
            or: "or",
            not: "not",
            not_equal: "!=",
            equal: None,
            integer_divide: Some("div"),
            concatenate: None,
            remainder: Some("mod"),
        },
        else_if: Some("elif"),
        command_calls: CommandCalls::Any,
        print_line: "echo",
        print_calls: Some(PrintCalls {
            line: &["echo"],
            text: &["stdout.write"],
            adjacent: true,
        }),
        typed: Typed::Annotation,
        types: Some(Types {
            nothing: "",
            ..INTEGER_TYPES
        }),
        return_arrow: Some(":"),
        terms: Terms {
            call: "procedure call",
            routine: "procedure",
        },
        ..JAVASCRIPT
    },
    Syntax {
        id: "d",
        for_each: Some("foreach ({variable}; {array})"),
        array_fill: Some(ArrayFill::NonZero),
        label: "D",
        naming: same(Convention::Camel),
        quotes: C_QUOTES,
        interpolation: &[],
        declarations: &["auto", "immutable"],
        symbols: &["~"],
        function_keyword: None,
        operators: Operators {
            concatenate: Some("~"),
            ..BRACE_OPERATORS
        },
        // writeln and write print their arguments one after another.
        print_line: "writeln",
        print_calls: Some(PrintCalls {
            line: &["writeln"],
            text: &["write"],
            adjacent: true,
        }),
        concatenate_call: Some("text"),
        prelude: &["import std.stdio;"],
        entry_point: EntryPoint::MainFunction,
        typed: Typed::Prefix,
        types: Some(Types {
            integer: "long",
            ..INTEGER_TYPES
        }),
        ..JAVASCRIPT
    },
    Syntax {
        id: "pascal",
        for_each: None,
        array_fill: Some(ArrayFill::NonZero),
        label: "Pascal",
        naming: same(Convention::Pascal),
        // Statements, routines and the program layout are in
        // dialects/pascal.rs.
        blocks: Blocks::Keywords,
        case_insensitive: true,
        // A routine called before its definition needs a `forward;` heading.
        forward_declarations: ForwardDeclarations::Heading,
        block_comment: Some(("{", "}")),
        quotes: &['\''],
        doubled_quotes: true,
        interpolation: &[],
        declarations: &[],
        symbols: &["<>"],
        function_keyword: None,
        assignment: Some(":="),
        compound_assignment: false,
        operators: Operators {
            and: "and",
            or: "or",
            not: "not",
            not_equal: "<>",
            equal: Some("="),
            integer_divide: Some("div"),
            concatenate: None,
            remainder: Some("mod"),
        },
        words: Some(("True", "False")),
        // WriteLn and Write print their arguments one after another.
        print_line: "WriteLn",
        print_calls: Some(PrintCalls {
            line: &["WriteLn"],
            text: &["Write"],
            adjacent: true,
        }),
        prelude: &["program Main;"],
        typed: Typed::Annotation,
        types: Some(Types {
            integer: "Int64",
            text: "String",
            boolean: "Boolean",
            nothing: "",
        }),
        terms: Terms {
            call: "procedure call",
            routine: "procedure",
        },
        ..JAVASCRIPT
    },
    Syntax {
        id: "fortran",
        for_each: None,
        array_base: 1,
        label: "Fortran",
        naming: same(Convention::Snake),
        // Statements, procedures and the program layout are in
        // dialects/fortran.rs.
        blocks: Blocks::Keywords,
        case_insensitive: true,
        line_comment: "!",
        block_comment: None,
        quotes: &['\'', '"'],
        doubled_quotes: true,
        interpolation: &[],
        declarations: &[],
        // Integer literals passed to integer(8) arguments carry the kind 8.
        long_suffix: Some("_8"),
        symbols: &[
            ".and.", ".or.", ".not.", ".true.", ".false.", ".eqv.", ".neqv.", "/=",
        ],
        function_keyword: None,
        compound_assignment: false,
        operators: Operators {
            and: ".and.",
            or: ".or.",
            not: ".not.",
            not_equal: "/=",
            equal: None,
            integer_divide: Some("/"),
            concatenate: Some("//"),
            remainder: None,
        },
        words: Some((".true.", ".false.")),
        // print and write list their items one after another.
        print_line: "print",
        print_calls: Some(PrintCalls {
            line: &["print"],
            text: &["write"],
            adjacent: true,
        }),
        typed: Typed::Annotation,
        types: Some(Types {
            integer: "integer(8)",
            text: "character",
            boolean: "logical",
            nothing: "",
        }),
        terms: Terms {
            call: "subroutine call",
            routine: "procedure",
        },
        ..JAVASCRIPT
    },
    Syntax {
        id: "ada",
        for_each: None,
        label: "Ada",
        naming: same(Convention::Ada),
        // In parameters are constants, so a reassigned one is copied first.
        immutable_parameters: ImmutableParameters::Renamed,
        // Statements, subprograms and the program layout are in
        // dialects/ada.rs.
        blocks: Blocks::Keywords,
        case_insensitive: true,
        // A subprogram called before its body is announced by its
        // specification.
        forward_declarations: ForwardDeclarations::Heading,
        line_comment: "--",
        block_comment: None,
        quotes: C_QUOTES,
        doubled_quotes: true,
        // The apostrophe of an attribute: Numbers'Length.
        symbols: &["'"],
        interpolation: &[],
        declarations: &[],
        function_keyword: None,
        assignment: Some(":="),
        compound_assignment: false,
        operators: Operators {
            and: "and then",
            or: "or else",
            not: "not",
            not_equal: "/=",
            equal: Some("="),
            integer_divide: Some("/"),
            concatenate: None,
            remainder: Some("rem"),
        },
        words: Some(("True", "False")),
        typed: Typed::Annotation,
        types: Some(Types {
            integer: "Long_Long_Integer",
            text: "String",
            boolean: "Boolean",
            nothing: "",
        }),
        terms: Terms {
            call: "procedure call",
            routine: "subprogram",
        },
        ..JAVASCRIPT
    },
    Syntax {
        id: "vb",
        for_each: None,
        array_fill: Some(ArrayFill::NonZero),
        label: "Visual Basic .NET",
        naming: Naming {
            function: Convention::Pascal,
            variable: Convention::Camel,
        },
        // Statements, procedures and the module layout are in dialects/vb.rs.
        blocks: Blocks::Keywords,
        case_insensitive: true,
        line_comment: "'",
        block_comment: None,
        quotes: C_QUOTES,
        doubled_quotes: true,
        interpolation: &[Interpolation {
            quote: Some('"'),
            prefix: Some("$"),
            style: InterpolationStyle::Braces,
        }],
        declarations: &[],
        symbols: &["<>"],
        function_keyword: None,
        operators: Operators {
            and: "AndAlso",
            or: "OrElse",
            not: "Not",
            not_equal: "<>",
            equal: Some("="),
            integer_divide: Some("\\"),
            concatenate: None,
            remainder: Some("Mod"),
        },
        words: Some(("True", "False")),
        typed: Typed::Annotation,
        types: Some(Types {
            integer: "Long",
            text: "String",
            boolean: "Boolean",
            nothing: "",
        }),
        terms: Terms {
            call: "procedure call",
            routine: "procedure",
        },
        ..JAVASCRIPT
    },
    Syntax {
        id: "bash",
        for_each: None,
        array_fill: Some(ArrayFill::Empty),
        label: "Bash",
        naming: same(Convention::Snake),
        // Commands, arithmetic and quoting are in dialects/bash.rs.
        blocks: Blocks::Keywords,
        line_comment: "#",
        block_comment: None,
        quotes: BOTH_QUOTES,
        interpolation: &[],
        declarations: &["local"],
        variable_sigil: Some('$'),
        function_keyword: None,
        operators: Operators {
            integer_divide: Some("/"),
            ..BRACE_OPERATORS
        },
        compound_assignment: false,
        words: Some(("1", "0")),
        ..JAVASCRIPT
    },
    Syntax {
        id: "matlab",
        for_each: None,
        array_base: 1,
        label: "MATLAB/Octave",
        naming: same(Convention::Snake),
        // Functions, fprintf formats and the script layout are in
        // dialects/matlab.rs.
        blocks: Blocks::Keywords,
        line_comment: "%",
        block_comment: None,
        quotes: &['\''],
        doubled_quotes: true,
        interpolation: &[],
        declarations: &[],
        symbols: &["~=", "~"],
        function_keyword: None,
        operators: Operators {
            not: "~",
            not_equal: "~=",
            ..BRACE_OPERATORS
        },
        // Numbers are doubles, so integer division truncates the quotient.
        integer_division: Some(IntegerDivision::Wrapper("fix")),
        compound_assignment: false,
        ..JAVASCRIPT
    },
    Syntax {
        id: "zig",
        for_each: None,
        label: "Zig",
        naming: Naming {
            function: Convention::Camel,
            variable: Convention::Snake,
        },
        immutable_parameters: ImmutableParameters::Renamed,
        // The output writer, builtins and loop continue expressions are in
        // dialects/zig.rs.
        block_comment: None,
        quotes: C_QUOTES,
        interpolation: &[],
        declarations: &["var", "const"],
        function_keyword: Some("fn"),
        operators: Operators {
            and: "and",
            or: "or",
            ..BRACE_OPERATORS
        },
        integer_division: Some(IntegerDivision::Call("@divTrunc")),
        entry_point: EntryPoint::MainFunction,
        typed: Typed::Annotation,
        types: Some(Types {
            integer: "i64",
            text: "[]const u8",
            boolean: "bool",
            nothing: "void",
        }),
        ..JAVASCRIPT
    },
    Syntax {
        id: "lean",
        nested_comments: true,
        for_each: None,
        label: "Lean",
        immutable_parameters: ImmutableParameters::Copied,
        // Definitions, do blocks and applications are in dialects/lean.rs.
        blocks: Blocks::Indentation,
        empty_statement: Some("pure ()"),
        line_comment: "--",
        block_comment: Some(("/-", "-/")),
        quotes: C_QUOTES,
        interpolation: &[Interpolation {
            quote: Some('"'),
            prefix: Some("s!"),
            style: InterpolationStyle::Braces,
        }],
        declarations: &["let"],
        symbols: &["...<"],
        function_keyword: None,
        assignment: Some(":="),
        compound_assignment: false,
        operators: Operators {
            concatenate: Some("++"),
            ..BRACE_OPERATORS
        },
        entry_point: EntryPoint::MainFunction,
        typed: Typed::Annotation,
        types: Some(Types {
            integer: "Int",
            text: "String",
            boolean: "Bool",
            nothing: "Unit",
        }),
        ..JAVASCRIPT
    },
    Syntax {
        id: "rocq",
        comment_strings: true,
        nested_comments: true,
        for_each: None,
        label: "Rocq",
        naming: same(Convention::Snake),
        // Fixpoints, actions and applications are in dialects/rocq.rs. Every
        // program opens with the runtime that gives its statements a meaning.
        header: Some(ROCQ_RUNTIME),
        blocks: Blocks::Keywords,
        line_comment: "(*",
        block_comment: Some(("(*", "*)")),
        quotes: C_QUOTES,
        doubled_quotes: true,
        interpolation: &[],
        declarations: &["let"],
        symbols: &["<=?", ">=?", "=?", "<?", ">?", ";;", "<-", "'"],
        function_keyword: None,
        assignment: Some(":="),
        compound_assignment: false,
        operators: Operators {
            not: "negb",
            equal: Some("=?"),
            concatenate: Some("++"),
            ..BRACE_OPERATORS
        },
        entry_point: EntryPoint::MainFunction,
        typed: Typed::Annotation,
        types: Some(Types {
            integer: "Z",
            text: "string",
            boolean: "bool",
            nothing: "unit",
        }),
        ..JAVASCRIPT
    },
];

/// The identifiers of the machine targets.
pub fn machine_target_ids() -> Vec<&'static str> {
    MACHINE_TARGETS.iter().map(|syntax| syntax.id).collect()
}

/// The description of a language by its identifier.
///
/// A language id may name a version after "@": `python@2` is Python with
/// the changes of Python 2 (see [`super::versions`]).
pub fn language_syntax(identifier: &str) -> Result<Syntax, GrammarError> {
    let (id, version) = split_version(identifier);
    let syntax = LANGUAGES
        .iter()
        .chain(MORE_LANGUAGES.iter())
        .chain(super::query_languages::QUERY_LANGUAGES.iter())
        .chain(MACHINE_TARGETS.iter())
        .find(|syntax| syntax.id == id)
        .cloned()
        .ok_or_else(|| {
            GrammarError::new(format!(
                "The grammar translator does not describe \"{identifier}\""
            ))
        })?;
    with_version(syntax, version)
}

/// The identifiers of every described language, in listing order.
pub fn language_ids() -> Vec<&'static str> {
    LANGUAGES
        .iter()
        .chain(MORE_LANGUAGES.iter())
        .map(|syntax| syntax.id)
        .collect()
}
