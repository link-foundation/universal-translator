//! Surface syntax descriptions for the grammar-based translator.
//!
//! Each description is plain data. The lexer, parser and emitter read these
//! tables, so supporting another language (or a project-specific dialect)
//! means describing it here.

use super::GrammarError;

/// How a language spells the neutral words of a declared name.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Convention {
    Camel,
    Pascal,
    Snake,
}

/// Naming conventions per role: functions and variables.
#[derive(Clone, Copy, Debug)]
pub struct Naming {
    pub function: Convention,
    pub variable: Convention,
}

const fn same(convention: Convention) -> Naming {
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
}

/// Where a language writes types, if at all.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Typed {
    No,
    Annotation,
    Prefix,
    Suffix,
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
    pub prefix: Option<char>,
    pub style: InterpolationStyle,
}

const fn embeds(quote: char, style: InterpolationStyle) -> Interpolation {
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
    /// Whether calls may leave out their parentheses: `puts "Hello"`.
    pub command_calls: bool,
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

const BRACE_OPERATORS: Operators = Operators {
    and: "&&",
    or: "||",
    not: "!",
    not_equal: "!=",
    equal: None,
    integer_divide: None,
    concatenate: None,
    remainder: None,
};

const SCRIPT_OPERATORS: Operators = Operators {
    equal: Some("==="),
    not_equal: "!==",
    ..BRACE_OPERATORS
};

const WORD_OPERATORS: Operators = Operators {
    and: "and",
    or: "or",
    not: "not",
    not_equal: "!=",
    equal: None,
    integer_divide: Some("//"),
    concatenate: None,
    remainder: None,
};

const INTEGER_TYPES: Types = Types {
    integer: "int",
    text: "string",
    boolean: "bool",
    nothing: "void",
};

const C_QUOTES: &[char] = &['"'];
const SCRIPT_QUOTES: &[char] = &['"', '\'', '`'];
const BOTH_QUOTES: &[char] = &['"', '\''];
const SLASH_COMMENTS: Option<(&str, &str)> = Some(("/*", "*/"));
const FUNCTION_TERMS: Terms = Terms {
    call: "function call",
    routine: "function",
};
const METHOD_TERMS: Terms = Terms {
    call: "method call",
    routine: "method",
};

const SCRIPT_DIVISION: Option<IntegerDivision> = Some(IntegerDivision::Wrapper("Math.trunc"));

/// The JavaScript description; the others start from it and change fields.
const JAVASCRIPT: Syntax = Syntax {
    id: "javascript",
    label: "JavaScript",
    naming: same(Convention::Camel),
    immutable_parameters: ImmutableParameters::No,
    blocks: Blocks::Braces,
    line_comment: "//",
    block_comment: SLASH_COMMENTS,
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
    command_calls: false,
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
};

/// The C description, the base of the other prefix-typed languages.
const C: Syntax = Syntax {
    id: "c",
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
    ..JAVASCRIPT
};

/// Every language the grammar translator describes, in listing order.
pub const LANGUAGES: [Syntax; 20] = [
    Syntax {
        integer_division: SCRIPT_DIVISION,
        ..JAVASCRIPT
    },
    Syntax {
        id: "typescript",
        integer_division: SCRIPT_DIVISION,
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
        label: "Python",
        naming: same(Convention::Snake),
        blocks: Blocks::Indentation,
        line_comment: "#",
        block_comment: None,
        quotes: BOTH_QUOTES,
        interpolation: &[Interpolation {
            quote: None,
            prefix: Some('f'),
            style: InterpolationStyle::Braces,
        }],
        declarations: &[],
        function_keyword: Some("def"),
        operators: WORD_OPERATORS,
        words: Some(("True", "False")),
        print_line: "print",
        ..JAVASCRIPT
    },
    Syntax {
        id: "ruby",
        label: "Ruby",
        naming: same(Convention::Snake),
        blocks: Blocks::End,
        line_comment: "#",
        block_comment: None,
        quotes: BOTH_QUOTES,
        interpolation: &[embeds('"', InterpolationStyle::HashBraces)],
        declarations: &[],
        function_keyword: Some("def"),
        command_calls: true,
        operators: BRACE_OPERATORS,
        else_if: Some("elsif"),
        print_line: "puts",
        terms: METHOD_TERMS,
        ..JAVASCRIPT
    },
    Syntax {
        id: "lua",
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
        ..JAVASCRIPT
    },
    Syntax {
        id: "php",
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
    C,
    Syntax {
        id: "cpp",
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
        label: "C#",
        naming: Naming {
            function: Convention::Pascal,
            variable: Convention::Camel,
        },
        interpolation: &[Interpolation {
            quote: Some('"'),
            prefix: Some('$'),
            style: InterpolationStyle::Braces,
        }],
        declarations: &["var"],
        print_line: "System.Console.WriteLine",
        entry_point: EntryPoint::ClassMethod,
        main_name: Some("Main"),
        types: Some(INTEGER_TYPES),
        terms: METHOD_TERMS,
        ..C
    },
    Syntax {
        id: "java",
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
        ..C
    },
    Syntax {
        id: "go",
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
        ..C
    },
    Syntax {
        id: "rust",
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
        ..C
    },
    Syntax {
        id: "kotlin",
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
        ..C
    },
    Syntax {
        id: "swift",
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
        ..C
    },
    Syntax {
        id: "perl",
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
        command_calls: true,
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
        label: "Scala",
        naming: same(Convention::Camel),
        immutable_parameters: ImmutableParameters::Renamed,
        long_suffix: Some("L"),
        quotes: C_QUOTES,
        interpolation: &[Interpolation {
            quote: Some('"'),
            prefix: Some('s'),
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
        }),
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
        }),
        entry_point: EntryPoint::MainFunction,
        call_main: Some("main()"),
        ..JAVASCRIPT
    },
    Syntax {
        id: "r",
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
        }),
        words: Some(("TRUE", "FALSE")),
        ..JAVASCRIPT
    },
    Syntax {
        id: "groovy",
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
        }),
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
];

/// The machine targets: x86-64 assembly (NASM), CIL and JVM bytecode. Only
/// the label, naming, comment marker and terms are read, by the context
/// rules.
pub const MACHINE_TARGETS: [Syntax; 3] = [
    Syntax {
        id: "nasm",
        label: "x86-64 assembly",
        naming: same(Convention::Snake),
        line_comment: ";",
        terms: Terms {
            call: "call instruction",
            routine: "procedure",
        },
        machine: true,
        ..C
    },
    Syntax {
        id: "cil",
        label: "CIL",
        naming: Naming {
            function: Convention::Pascal,
            variable: Convention::Camel,
        },
        line_comment: "//",
        terms: METHOD_TERMS,
        machine: true,
        ..C
    },
    Syntax {
        id: "jvm",
        label: "JVM bytecode",
        naming: same(Convention::Camel),
        line_comment: ";",
        terms: METHOD_TERMS,
        machine: true,
        ..C
    },
];

/// The identifiers of the machine targets.
pub fn machine_target_ids() -> Vec<&'static str> {
    MACHINE_TARGETS.iter().map(|syntax| syntax.id).collect()
}

/// The description of a language by its identifier.
pub fn language_syntax(identifier: &str) -> Result<Syntax, GrammarError> {
    LANGUAGES
        .iter()
        .chain(MACHINE_TARGETS.iter())
        .find(|syntax| syntax.id == identifier)
        .cloned()
        .ok_or_else(|| {
            GrammarError::new(format!(
                "The grammar translator does not describe \"{identifier}\""
            ))
        })
}

/// The identifiers of every described language, in listing order.
pub fn language_ids() -> Vec<&'static str> {
    LANGUAGES.iter().map(|syntax| syntax.id).collect()
}
