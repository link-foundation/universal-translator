# Open requirements

The Issue 16 acceptance inventory records the original wording, implemented
subsets and historical references. Each item below needs executable evidence
before it can be checked off. Completed groups are stored in
[the requirements archive](requirements-archive).
[Issue 16 acceptance inventory](case-studies/issue-16/REQUIREMENTS.md)

## UT-16.2 Complete concrete layout and comment coverage

- [ ] Audit grammar productions that carry comments and trivia across formal, natural, query and machine grammars.
- [ ] Verify lossless source bytes around translated comments in every applicable production and edition.
- [ ] Verify terminology, grammatical agreement and distinct source regions for comments split or reordered by a target.

## UT-16.3 Complete semantic line and region mapping

- [ ] Audit alignment through formal, natural and machine expansion, including declaration references, argument order, ambiguity and partial recovery.
- [ ] Reproduce and fix the reported Monaco gutter highlight below the last source line.

## UT-16.5 Compose controlled prose and comment agreement

- [ ] Generalize recursive expressions and clauses beyond the verified Russian grammatical cases while preserving referent identity.
- [ ] Compose natural and formal terms from a recursive ontology and grammar, replacing the task-specific patterns in the natural standards.
- [ ] Audit qualified terms, inflection and ambiguous clause boundaries in both translation engines and every applicable edition.

## UT-16.7 Preserve operators and runtime contracts

- [ ] Inventory operators by source grammar, target grammar, operand type and edition.
- [ ] Preserve integer widths, overflow, zero divisors, signed zero, evaluation order and real arithmetic, with native comparisons at contract boundaries.
- [ ] Verify every operator and supported lowering with cross-language round trips and observable-effect tests.
- [ ] Audit mutable container bindings, element mutation and aliases across languages.

## UT-16.8 Complete framework and exception translation

- [ ] Verify framework-independent translation for annotated parameters, nested generics and chained member calls across targets.
- [ ] Preserve exception values, matching, rethrow and cleanup across the remaining formal, controlled-natural and machine targets.
- [ ] Expand class, constructor and object-instance representations and fragment round trips.

## UT-16.9 Complete grammar coverage and language editions

- [ ] Extend the executable grammar workspace to full upstream productions and semantically faithful adapters with lossless CSTs.
- [ ] Implement and verify the missing top-50 language grammars and editions, including controlled natural grammar variants.
- [ ] Preserve scoped source declarations, calls and imports when translating standard and other libraries.
- [ ] Read binary machine formats and implement supported machine and bytecode editions with finite native fixtures.

## UT-16.10 Measure competing readings

- [ ] Expand measured prose frequencies beyond the Russian noun family verified in `case-studies/issue-16/CORPUS-FREQUENCIES.md`.
- [ ] Extend code statistics beyond task presence and verify competing grammatical meanings within individual formal languages.

## UT-16.12 Complete questions and query contracts

- [ ] Preserve introspection across remaining programming, natural, SQL and LINQ targets.
- [ ] Implement runtime-equivalent schema and dialect behavior, including nulls, typing, coercion and broader query clauses.
- [ ] Verify composition of questions with scoped predicates, multiple clauses and projections.

## UT-16.18 Expand inherited program coverage

- [ ] Increase verified Rosetta Code coverage by more than 100 distinct task types against the existing baseline. Both engines pass the pinned C++ solutions for `Ascending primes`, `Queue/Usage`, `Order two numerical lists` and `Jewels and stones`.
- [ ] Extend original-source round trips and behavioral equivalence through all 1,758 historical Rosetta Code tasks, including strings, data structures, I/O, objects and concurrency.
- [ ] Finish native Portable Object Compiler collection translations through the remaining target families.
- [ ] Verify the JavaScript portable Meta Language integration.
- [ ] Recheck previously delivered historical criteria using the sources indexed in the Issue 16 acceptance inventory.

## UT-16.22 Maintain issue evidence and verification

- [ ] Update the case study with current investigation evidence, requirement decisions, exact reproductions and final-commit CI.
- [ ] Verify that the default-branch pipeline exposes required human actions explicitly and that all checks pass at the final issue-branch commit.
