//! Reproduce a scope lost when a published Meta Language 1.1.0 merge is merged again.
use meta_language::grammar::feature_runtime::{FeatureParseOptions, compile_feature_grammar};
use meta_language::grammar::interchange::{grammar_emitter, grammar_importer};
use meta_language::grammar::merge::{GrammarMergeOptions, GrammarMergeSource, merge_grammars};

const INPUT: &str = "hello мир";

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let antlr = grammar_importer("antlr").unwrap();
    let native = grammar_importer("native").unwrap();
    let export = grammar_emitter("native").unwrap();
    let grammar = antlr("grammar Hello;\nstart: 'hello' ' ' 'мир' EOF;\n")?;
    let merged = merge_grammars(
        &[GrammarMergeSource::new("one", "toy", grammar)],
        &GrammarMergeOptions::default(),
    )?;
    let (listing, _) = export(&merged.groups[0].grammar)?;
    let imported = native(&listing)?;
    let options = FeatureParseOptions {
        step_limit: Some(100_000),
        memo_limit: Some(10_000),
        memory_limit: Some(30_000),
        ..Default::default()
    };
    let parser = compile_feature_grammar(&imported, None, options.clone())?;
    assert!(parser.parse_tree(INPUT.as_bytes(), &options)?.ok);
    println!("Imported native listing accepts its original input");

    let merged_again = merge_grammars(
        &[GrammarMergeSource::new("copy", "toy", imported)],
        &GrammarMergeOptions::default(),
    )?;
    let grammar = &merged_again.groups[0].grammar;
    let (listing, _) = export(grammar)?;
    for line in listing
        .lines()
        .filter(|line| line.starts_with("lexer ") || line.contains("lexicalScope"))
    {
        println!("{line}");
    }
    let parser = compile_feature_grammar(grammar, None, options.clone())?;
    assert!(parser.parse_tree(INPUT.as_bytes(), &options)?.ok);
    println!("Remerged native listing accepts its original input");
    Ok(())
}
