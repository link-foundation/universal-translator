//! Keep source-local lexer bindings when a grammar joins another merge.
use meta_language::grammar::{FeatureExpr, FieldValue, Grammar, GrammarExpr};
use std::collections::BTreeSet;

/// Meta Language prefixes lexer declarations with the merge source ID. Its
/// 1.1.0 merger also generates scoped references for raw lexer bindings but
/// leaves existing scope names unchanged. Qualify the existing references
/// separately for each source before the merger compares productions.
pub(super) fn qualify_existing_scopes(source_id: &str, grammar: &Grammar) -> Option<Grammar> {
    let declared: BTreeSet<&str> = grammar
        .declarations()
        .lexers
        .iter()
        .map(|lexer| lexer.name.as_str())
        .collect();
    if declared.is_empty() {
        return None;
    }
    let mut changed = false;
    let mut qualify = |expr: &mut GrammarExpr| {
        changed |= qualify_expr(expr, source_id, &declared);
    };
    let mut updated = Grammar::new();
    if let Some(format) = grammar.source_format() {
        updated.set_source_format(format);
    }
    if let Some(start) = grammar.start() {
        updated.set_start(start);
    }
    updated.set_kinds(grammar.kinds().to_vec());
    for mut rule in grammar.rules().iter().cloned() {
        qualify(&mut rule.expr);
        if let Some(actions) = &mut rule.attributes.action {
            for action in actions {
                action.map_expressions(&mut qualify);
            }
        }
        updated.add_rule(rule);
    }
    let mut declarations = grammar.declarations().clone();
    declarations.extras.iter_mut().for_each(&mut qualify);
    for declared in &mut declarations.macros {
        qualify(&mut declared.expression);
    }
    for scanner in &mut declarations.scanners {
        for operation in &mut scanner.operations {
            operation.map_expressions(&mut qualify);
        }
    }
    for lexer in &mut declarations.lexers {
        qualify(&mut lexer.expression);
    }
    updated.set_declarations(declarations);
    changed.then_some(updated)
}

fn qualify_expr(expr: &mut GrammarExpr, source_id: &str, declared: &BTreeSet<&str>) -> bool {
    match expr {
        GrammarExpr::Optional(inner)
        | GrammarExpr::ZeroOrMore(inner)
        | GrammarExpr::OneOrMore(inner)
        | GrammarExpr::And(inner)
        | GrammarExpr::Not(inner)
        | GrammarExpr::Repeat { expr: inner, .. }
        | GrammarExpr::Capture { expr: inner, .. } => qualify_expr(inner, source_id, declared),
        GrammarExpr::Sequence(items)
        | GrammarExpr::Choice {
            alternatives: items,
            ..
        } => {
            let mut changed = false;
            for item in items {
                changed |= qualify_expr(item, source_id, declared);
            }
            changed
        }
        GrammarExpr::Feature(feature) => {
            let mut changed = false;
            if let FeatureExpr::Form(form) = feature.as_mut()
                && matches!(form.head.as_str(), "lexicalScope" | "lexicalToken")
                && let Some(FieldValue::Name(name)) = form.fields.first_mut()
                && declared.contains(name.as_str())
            {
                *name = format!("{source_id}::{name}");
                changed = true;
            }
            feature.map_expressions(&mut |inner| {
                changed |= qualify_expr(inner, source_id, declared);
            });
            changed
        }
        _ => false,
    }
}
