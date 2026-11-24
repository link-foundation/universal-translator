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
}

/// Spellings of the meta types integer, text, boolean and nothing.
#[derive(Clone, Copy, Debug)]
pub struct Types {
    pub integer: &'static str,
    pub text: &'static str,
    pub boolean: &'static str,
    pub nothing: &'static str,
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
    pub immutable_parameters: bool,
    pub blocks: Blocks,
    pub line_comment: &'static str,
    pub block_comment: Option<(&'static str, &'static str)>,
    pub quotes: &'static [char],
    pub declarations: &'static [&'static str],
    pub variable_sigil: Option<char>,
    pub function_keyword: Option<&'static str>,
    pub operators: Operators,
    /// Spellings of `true` and `false` where they differ.
    pub words: Option<(&'static str, &'static str)>,
    pub else_if: Option<&'static str>,
    pub print_line: &'static str,
    pub entry_point: EntryPoint,
    pub main_name: Option<&'static str>,
    pub header: Option<&'static str>,
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

/// The JavaScript description; the others start from it and change fields.
const JAVASCRIPT: Syntax = Syntax {
    id: "javascript",
    label: "JavaScript",
    naming: same(Convention::Camel),
    immutable_parameters: false,
    blocks: Blocks::Braces,
    line_comment: "//",
    block_comment: SLASH_COMMENTS,
    quotes: SCRIPT_QUOTES,
    declarations: &["let", "const", "var"],
    variable_sigil: None,
    function_keyword: Some("function"),
    operators: SCRIPT_OPERATORS,
    words: None,
    else_if: None,
    print_line: "console.log",
    entry_point: EntryPoint::TopLevel,
    main_name: None,
    header: None,
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
pub const LANGUAGES: [Syntax; 14] = [
    JAVASCRIPT,
    Syntax {
        id: "typescript",
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
        declarations: &[],
        function_keyword: Some("def"),
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
        declarations: &["local"],
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
        quotes: BOTH_QUOTES,
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
        immutable_parameters: true,
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
        immutable_parameters: true,
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
        immutable_parameters: true,
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
