//! Controlled natural languages, described as data in data/natural/*.lino.
//!
//! Each file describes one controlled version of a natural language (or one
//! profile of it, such as Attempto Controlled English): the sentence for
//! every meta statement, the phrase for every operator, and a lexicon that
//! translates the words of program names. The writer and the reader both
//! use these tables, so a sentence the writer produces is exactly a sentence
//! the reader accepts. The JavaScript twin is js/src/natural/catalog.js.

use std::collections::{BTreeMap, HashMap, HashSet};
use std::sync::LazyLock;

use links_notation::LiNo;

use super::tokens::{Spelling, Token, fold, tokenize};
use crate::meta::links::Link;

/// The embedded data/natural/*.lino files, in file name order.
pub const SOURCES: &[(&str, &str)] = &[
    (
        "arabic.lino",
        include_str!("../../../data/natural/arabic.lino"),
    ),
    (
        "bengali.lino",
        include_str!("../../../data/natural/bengali.lino"),
    ),
    (
        "chinese.lino",
        include_str!("../../../data/natural/chinese.lino"),
    ),
    (
        "dutch-gellish.lino",
        include_str!("../../../data/natural/dutch-gellish.lino"),
    ),
    (
        "dutch.lino",
        include_str!("../../../data/natural/dutch.lino"),
    ),
    (
        "english-ace.lino",
        include_str!("../../../data/natural/english-ace.lino"),
    ),
    (
        "english-asd-ste100.lino",
        include_str!("../../../data/natural/english-asd-ste100.lino"),
    ),
    (
        "english-basic-english.lino",
        include_str!("../../../data/natural/english-basic-english.lino"),
    ),
    (
        "english-british.lino",
        include_str!("../../../data/natural/english-british.lino"),
    ),
    (
        "english-e-prime.lino",
        include_str!("../../../data/natural/english-e-prime.lino"),
    ),
    (
        "english-gellish.lino",
        include_str!("../../../data/natural/english-gellish.lino"),
    ),
    (
        "english-globish.lino",
        include_str!("../../../data/natural/english-globish.lino"),
    ),
    (
        "english-plain-language.lino",
        include_str!("../../../data/natural/english-plain-language.lino"),
    ),
    (
        "english-sbvr.lino",
        include_str!("../../../data/natural/english-sbvr.lino"),
    ),
    (
        "english-special-english.lino",
        include_str!("../../../data/natural/english-special-english.lino"),
    ),
    (
        "english.lino",
        include_str!("../../../data/natural/english.lino"),
    ),
    (
        "french.lino",
        include_str!("../../../data/natural/french.lino"),
    ),
    (
        "german.lino",
        include_str!("../../../data/natural/german.lino"),
    ),
    (
        "gujarati.lino",
        include_str!("../../../data/natural/gujarati.lino"),
    ),
    (
        "hausa.lino",
        include_str!("../../../data/natural/hausa.lino"),
    ),
    (
        "hindi.lino",
        include_str!("../../../data/natural/hindi.lino"),
    ),
    (
        "indonesian.lino",
        include_str!("../../../data/natural/indonesian.lino"),
    ),
    (
        "italian.lino",
        include_str!("../../../data/natural/italian.lino"),
    ),
    (
        "japanese.lino",
        include_str!("../../../data/natural/japanese.lino"),
    ),
    (
        "korean.lino",
        include_str!("../../../data/natural/korean.lino"),
    ),
    (
        "marathi.lino",
        include_str!("../../../data/natural/marathi.lino"),
    ),
    (
        "minimal-arabic.lino",
        include_str!("../../../data/natural/minimal-arabic.lino"),
    ),
    (
        "minimal-bengali.lino",
        include_str!("../../../data/natural/minimal-bengali.lino"),
    ),
    (
        "minimal-chinese.lino",
        include_str!("../../../data/natural/minimal-chinese.lino"),
    ),
    (
        "minimal-dutch.lino",
        include_str!("../../../data/natural/minimal-dutch.lino"),
    ),
    (
        "minimal-english.lino",
        include_str!("../../../data/natural/minimal-english.lino"),
    ),
    (
        "minimal-french.lino",
        include_str!("../../../data/natural/minimal-french.lino"),
    ),
    (
        "minimal-german.lino",
        include_str!("../../../data/natural/minimal-german.lino"),
    ),
    (
        "minimal-gujarati.lino",
        include_str!("../../../data/natural/minimal-gujarati.lino"),
    ),
    (
        "minimal-hausa.lino",
        include_str!("../../../data/natural/minimal-hausa.lino"),
    ),
    (
        "minimal-hindi.lino",
        include_str!("../../../data/natural/minimal-hindi.lino"),
    ),
    (
        "minimal-indonesian.lino",
        include_str!("../../../data/natural/minimal-indonesian.lino"),
    ),
    (
        "minimal-italian.lino",
        include_str!("../../../data/natural/minimal-italian.lino"),
    ),
    (
        "minimal-japanese.lino",
        include_str!("../../../data/natural/minimal-japanese.lino"),
    ),
    (
        "minimal-korean.lino",
        include_str!("../../../data/natural/minimal-korean.lino"),
    ),
    (
        "minimal-marathi.lino",
        include_str!("../../../data/natural/minimal-marathi.lino"),
    ),
    (
        "minimal-persian.lino",
        include_str!("../../../data/natural/minimal-persian.lino"),
    ),
    (
        "minimal-polish.lino",
        include_str!("../../../data/natural/minimal-polish.lino"),
    ),
    (
        "minimal-portuguese.lino",
        include_str!("../../../data/natural/minimal-portuguese.lino"),
    ),
    (
        "minimal-punjabi.lino",
        include_str!("../../../data/natural/minimal-punjabi.lino"),
    ),
    (
        "minimal-russian.lino",
        include_str!("../../../data/natural/minimal-russian.lino"),
    ),
    (
        "minimal-spanish.lino",
        include_str!("../../../data/natural/minimal-spanish.lino"),
    ),
    (
        "minimal-swahili.lino",
        include_str!("../../../data/natural/minimal-swahili.lino"),
    ),
    (
        "minimal-tagalog.lino",
        include_str!("../../../data/natural/minimal-tagalog.lino"),
    ),
    (
        "minimal-tamil.lino",
        include_str!("../../../data/natural/minimal-tamil.lino"),
    ),
    (
        "minimal-telugu.lino",
        include_str!("../../../data/natural/minimal-telugu.lino"),
    ),
    (
        "minimal-thai.lino",
        include_str!("../../../data/natural/minimal-thai.lino"),
    ),
    (
        "minimal-turkish.lino",
        include_str!("../../../data/natural/minimal-turkish.lino"),
    ),
    (
        "minimal-ukrainian.lino",
        include_str!("../../../data/natural/minimal-ukrainian.lino"),
    ),
    (
        "minimal-urdu.lino",
        include_str!("../../../data/natural/minimal-urdu.lino"),
    ),
    (
        "minimal-vietnamese.lino",
        include_str!("../../../data/natural/minimal-vietnamese.lino"),
    ),
    (
        "persian.lino",
        include_str!("../../../data/natural/persian.lino"),
    ),
    (
        "polish.lino",
        include_str!("../../../data/natural/polish.lino"),
    ),
    (
        "portuguese.lino",
        include_str!("../../../data/natural/portuguese.lino"),
    ),
    (
        "punjabi.lino",
        include_str!("../../../data/natural/punjabi.lino"),
    ),
    (
        "russian.lino",
        include_str!("../../../data/natural/russian.lino"),
    ),
    (
        "semantic-primes.lino",
        include_str!("../../../data/natural/semantic-primes.lino"),
    ),
    (
        "spanish.lino",
        include_str!("../../../data/natural/spanish.lino"),
    ),
    (
        "swahili.lino",
        include_str!("../../../data/natural/swahili.lino"),
    ),
    (
        "tagalog.lino",
        include_str!("../../../data/natural/tagalog.lino"),
    ),
    (
        "tamil.lino",
        include_str!("../../../data/natural/tamil.lino"),
    ),
    (
        "telugu.lino",
        include_str!("../../../data/natural/telugu.lino"),
    ),
    ("thai.lino", include_str!("../../../data/natural/thai.lino")),
    (
        "turkish.lino",
        include_str!("../../../data/natural/turkish.lino"),
    ),
    (
        "ukrainian.lino",
        include_str!("../../../data/natural/ukrainian.lino"),
    ),
    ("urdu.lino", include_str!("../../../data/natural/urdu.lino")),
    (
        "vietnamese.lino",
        include_str!("../../../data/natural/vietnamese.lino"),
    ),
];

/// The file of the semantic primes, which describes no language.
pub const PRIMES_FILE: &str = "semantic-primes.lino";

/// Every statement and expression form a language must describe.
pub const TEMPLATE_KEYS: [&str; 38] = [
    "function",
    "function-without-parameters",
    "declare",
    "assign",
    "print-line",
    "print",
    "return-value",
    "return",
    "evaluate",
    "nothing",
    "if",
    "else-if",
    "else",
    "while",
    "for",
    "call",
    "call-without-arguments",
    "array",
    "new-array",
    "element",
    "length",
    "set-element",
    "join",
    "or",
    "and",
    "not",
    "negate",
    "equal",
    "not-equal",
    "less",
    "less-or-equal",
    "greater",
    "greater-or-equal",
    "add",
    "subtract",
    "multiply",
    "divide",
    "remainder",
];

const SCALAR_FIELDS: [&str; 16] = [
    "id",
    "label",
    "native-label",
    "extends",
    "profile",
    "family",
    "sentence-end",
    "block-end",
    "list-separator",
    "list-and",
    "name-joiner",
    "true",
    "false",
    "note",
    "speakers",
    "source",
];

/// Entries in the order a description lists them; a later entry with the
/// same key replaces an earlier one in place, as JavaScript objects do.
#[derive(Clone, Debug, Default)]
pub struct Ordered<T> {
    pub entries: Vec<(String, T)>,
}

impl<T: Clone> Ordered<T> {
    pub fn get(&self, key: &str) -> Option<&T> {
        self.entries
            .iter()
            .find(|(name, _)| name == key)
            .map(|(_, value)| value)
    }

    pub fn insert(&mut self, key: &str, value: T) {
        match self.entries.iter_mut().find(|(name, _)| name == key) {
            Some(entry) => entry.1 = value,
            None => self.entries.push((key.to_owned(), value)),
        }
    }

    fn merged(&self, other: &Ordered<T>) -> Ordered<T> {
        let mut result = self.clone();
        for (key, value) in &other.entries {
            result.insert(key, value.clone());
        }
        result
    }
}

#[derive(Clone, Debug, Default)]
struct Description {
    scalars: BTreeMap<String, String>,
    quotes: Option<Vec<String>>,
    templates: Ordered<Vec<String>>,
    words: Ordered<String>,
    rules: Ordered<Vec<String>>,
    base: Option<String>,
}

/// A compiled controlled natural language.
#[derive(Clone, Debug)]
pub struct Language {
    pub id: String,
    pub label: String,
    /// The language a profile extends, through every level.
    pub base: Option<String>,
    pub profile: Option<String>,
    pub sentence_end: String,
    pub block_end: String,
    pub list_separator: String,
    pub list_and: Option<String>,
    pub name_joiner: String,
    pub true_word: String,
    pub false_word: String,
    pub note: String,
    pub quotes: (String, String),
    pub templates: Ordered<Vec<String>>,
    pub compiled: HashMap<String, Vec<Vec<Token>>>,
    pub rules: Ordered<Vec<String>>,
    /// Neutral word -> the language's word, in listing order.
    pub lexicon: Ordered<String>,
    pub reverse_lexicon: HashMap<String, String>,
    /// Words that appear literally in templates.
    pub reserved: HashSet<String>,
}

impl Language {
    pub fn spelling(&self) -> Spelling<'_> {
        Spelling {
            quotes: (&self.quotes.0, &self.quotes.1),
            list_separator: &self.list_separator,
            name_joiner: &self.name_joiner,
        }
    }

    /// The tokens of a sentence in this language.
    pub fn tokenize(&self, text: &str) -> Result<Vec<Token>, String> {
        tokenize(text, &self.spelling(), false)
    }

    /// The compiled variants of a template (empty when it has none).
    pub fn variants(&self, key: &str) -> &[Vec<Token>] {
        self.compiled
            .get(key)
            .map(Vec::as_slice)
            .unwrap_or_default()
    }

    /// A rule's values (empty when the language does not state it).
    pub fn rule(&self, name: &str) -> &[String] {
        self.rules.get(name).map(Vec::as_slice).unwrap_or_default()
    }
}

/// The name of a link, or the text of a reference.
pub(crate) fn label_of(link: &Link) -> &str {
    match link {
        LiNo::Ref(reference) => reference,
        LiNo::Link { id, .. } => id.as_deref().unwrap_or_default(),
    }
}

/// The values of a link (empty for a reference).
pub(crate) fn values_of(link: &Link) -> &[Link] {
    match link {
        LiNo::Ref(_) => &[],
        LiNo::Link { values, .. } => values,
    }
}

pub(crate) fn plain(values: &[Link]) -> Vec<String> {
    values
        .iter()
        .map(|value| label_of(value).to_owned())
        .collect()
}

/// The first root link of a Links Notation document.
pub(crate) fn parse_root(source: &str) -> Result<Link, String> {
    links_notation::parse_lino_to_links(source)
        .map_err(|error| error.to_string())?
        .into_iter()
        .next()
        .ok_or_else(|| "An empty document".to_owned())
}

fn read_description(source: &str) -> Result<Description, String> {
    let root = parse_root(source)?;
    if label_of(&root) != "natural" {
        return Err("A natural language description starts with \"natural:\"".into());
    }
    let mut description = Description::default();
    for field in values_of(&root) {
        let id = label_of(field);
        let values = values_of(field);
        if SCALAR_FIELDS.contains(&id) {
            description
                .scalars
                .insert(id.to_owned(), plain(values).join(" "));
        } else if id == "quotes" {
            description.quotes = Some(plain(values));
        } else if id == "templates" {
            for entry in values {
                description
                    .templates
                    .insert(label_of(entry), plain(values_of(entry)));
            }
        } else if id == "words" {
            for entry in values {
                description
                    .words
                    .insert(label_of(entry), plain(values_of(entry)).join(" "));
            }
        } else if id == "rules" {
            for entry in values {
                description
                    .rules
                    .insert(label_of(entry), plain(values_of(entry)));
            }
        } else {
            return Err(format!("Unknown natural language field \"{id}\""));
        }
    }
    Ok(description)
}

/// A profile inherits everything it does not state from the language it
/// extends; its own rules replace the inherited rules.
fn resolve(
    descriptions: &BTreeMap<String, Description>,
    id: &str,
    seen: &mut HashSet<String>,
) -> Result<Description, String> {
    let description = descriptions
        .get(id)
        .ok_or_else(|| format!("No natural language \"{id}\""))?;
    let Some(extends) = description.scalars.get("extends") else {
        return Ok(description.clone());
    };
    if !seen.insert(id.to_owned()) {
        return Err(format!("Natural language \"{id}\" extends itself"));
    }
    let base = resolve(descriptions, extends, seen)?;
    let mut scalars = base.scalars.clone();
    scalars.extend(description.scalars.clone());
    Ok(Description {
        scalars,
        quotes: description.quotes.clone().or(base.quotes.clone()),
        templates: base.templates.merged(&description.templates),
        words: base.words.merged(&description.words),
        rules: description.rules.clone(),
        base: Some(
            base.base
                .clone()
                .unwrap_or_else(|| base.scalars.get("id").cloned().unwrap_or_default()),
        ),
    })
}

/// Templates become token lists once, with slot tokens for the holes.
fn compile(description: Description) -> Result<Language, String> {
    let scalar = |key: &str| description.scalars.get(key).cloned();
    let id = scalar("id").unwrap_or_default();
    let missing: Vec<&str> = TEMPLATE_KEYS
        .iter()
        .copied()
        .filter(|key| description.templates.get(key).is_none())
        .collect();
    if !missing.is_empty() {
        return Err(format!("{id} has no {} template", missing.join(", ")));
    }
    let quotes = description
        .quotes
        .clone()
        .unwrap_or_else(|| vec!["\"".into(), "\"".into()]);
    let mut language = Language {
        label: scalar("label").unwrap_or_default(),
        base: description.base.clone(),
        profile: scalar("profile"),
        sentence_end: scalar("sentence-end").unwrap_or_else(|| ".".into()),
        block_end: scalar("block-end").unwrap_or_else(|| ":".into()),
        list_separator: scalar("list-separator").unwrap_or_else(|| ",".into()),
        list_and: scalar("list-and"),
        name_joiner: scalar("name-joiner").unwrap_or_else(|| "-".into()),
        true_word: scalar("true").unwrap_or_default(),
        false_word: scalar("false").unwrap_or_default(),
        note: scalar("note").unwrap_or_default(),
        quotes: (
            quotes.first().cloned().unwrap_or_default(),
            quotes.get(1).cloned().unwrap_or_default(),
        ),
        templates: description.templates.clone(),
        compiled: HashMap::new(),
        rules: description.rules.clone(),
        lexicon: description.words.clone(),
        reverse_lexicon: HashMap::new(),
        reserved: HashSet::new(),
        id,
    };
    for (key, texts) in &description.templates.entries {
        let variants = texts
            .iter()
            .map(|text| tokenize(text, &language.spelling(), true))
            .collect::<Result<Vec<_>, _>>()?;
        language.compiled.insert(key.clone(), variants);
    }
    // Every word that appears literally in a template is reserved: a program
    // name spelled the same way gets a trailing "_" so it stays a name.
    let mut reserved: HashSet<String> = language
        .compiled
        .values()
        .flatten()
        .flatten()
        .filter(|token| token.kind == super::tokens::Kind::Word)
        .map(|token| fold(&token.folded))
        .collect();
    for word in [
        Some(&language.true_word),
        Some(&language.false_word),
        language.list_and.as_ref(),
    ]
    .into_iter()
    .flatten()
    .filter(|word| !word.is_empty())
    {
        reserved.insert(fold(word));
    }
    language.reserved = reserved;
    language.reverse_lexicon = language
        .lexicon
        .entries
        .iter()
        .map(|(neutral, word)| (fold(word), neutral.clone()))
        .collect();
    Ok(language)
}

struct Catalog {
    ids: Vec<String>,
    languages: HashMap<String, Language>,
}

fn load() -> Result<Catalog, String> {
    let mut descriptions = BTreeMap::new();
    let mut ids = Vec::new();
    let mut sources: Vec<&(&str, &str)> = SOURCES.iter().collect();
    sources.sort_by_key(|(file, _)| *file);
    for (file, source) in sources {
        if *file == PRIMES_FILE {
            continue;
        }
        let description = read_description(source).map_err(|error| format!("{file}: {error}"))?;
        let id = description.scalars.get("id").cloned().unwrap_or_default();
        if format!("{id}.lino") != *file {
            return Err(format!("{file} describes \"{id}\""));
        }
        ids.push(id.clone());
        descriptions.insert(id, description);
    }
    let mut languages = HashMap::new();
    for id in &ids {
        let resolved = resolve(&descriptions, id, &mut HashSet::new())?;
        languages.insert(id.clone(), compile(resolved)?);
    }
    Ok(Catalog { ids, languages })
}

static CATALOG: LazyLock<Result<Catalog, String>> = LazyLock::new(load);

fn catalog() -> Result<&'static Catalog, String> {
    CATALOG.as_ref().map_err(Clone::clone)
}

/// The compiled description of a controlled natural language.
pub fn natural_language(id: &str) -> Result<&'static Language, String> {
    catalog()?
        .languages
        .get(id)
        .ok_or_else(|| format!("No controlled natural language \"{id}\""))
}

/// Whether `id` names a controlled natural language (or profile).
pub fn is_natural_language(id: &str) -> bool {
    catalog().is_ok_and(|catalog| catalog.languages.contains_key(id))
}

/// Ids of every controlled natural language and profile, in file order.
pub fn natural_language_ids() -> Vec<&'static str> {
    catalog()
        .map(|catalog| catalog.ids.iter().map(String::as_str).collect())
        .unwrap_or_default()
}
