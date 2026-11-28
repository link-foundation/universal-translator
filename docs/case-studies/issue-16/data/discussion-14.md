# 14: CST must be by default, that means whitespace should be preserved as close as possible in translation and other fixes and improvements

Here it is clearly visible the whitespace was not preserved at all (didn't not survive the translation):

<img width="1824" height="1123" alt="Screenshot 2026-11-25 at 9 44 25 PM" src="https://github.com/user-attachments/assets/222876d2-adc4-4b4d-9617-fc671c4fce74" />

We should also make monaco editor default, and make sure we provide correct display for collapsable/expandable regions.

We should also should make them in sync in left and right editor, so if left block is collapsed, the equivalent also collapsed on the right.

Selection on the left should be reflected also on the right and so on.

So it is easy to see visually what translates to what.

Cursor and scrolling also, though some regions of code can be smaller or larger in translated language in that case scrolling should adjust for that. We should also need to have mapping visualization, I seen it in diffs or something else, find best solution for such UI/UX cases online.

`Comment language`, `Identifiers language` and so on should be both to the left and to the right, so we can translate each of them separately.

So for example comments in russian can be mapped to comments in english, and identifiers in chinese to identifies in hindi and so on.

<img width="1824" height="1123" alt="Screenshot 2026-11-25 at 9 52 49 PM" src="https://github.com/user-attachments/assets/446b284e-6461-4ecb-80d5-267cec67ba06" />

Also it is clearly visible we didn't translate comments language at all, yet I selected English.

All checkboxes settings can be moved to botton (under all monaco editors, as used not so frequently).

We also need to make our grammar and dictionary deeper/recursive, meaning we should better reflect details of natural languages, words, sentences, parts of speech and so on.

Not all statements/questions in natural language can be translated to a programming language, but we still should be able to translate them between each other as perfectly as we can, best option of translation is the most frequent cases on both sides which are likely to survive roundtrip. We still can have some data loss in the translation so some round trip cannot work because of language specific details, yet if more precise sentences are provided we should be better in translation.

(language autodetect failed):
<img width="1532" height="856" alt="telegram-cloud-photo-size-2-5204323881475317970-w" src="https://github.com/user-attachments/assets/54119e12-d1bf-435b-8f45-16b3abd609e9" />

(translation failed):
<img width="2344" height="1030" alt="telegram-cloud-photo-size-2-5204323881475317962-w" src="https://github.com/user-attachments/assets/09f83403-e6d7-4de7-902e-44b9f5f09a75" />

In the meta language itself comment if contains message in natural language should be deeply parsed (if it is too verbose we can just have a link with identifier for it, which we can reuse in the code expresssion), and we should support nesting of grammars to each other, for example we can have natural language, where code experession is nested, and also we can have programming language where natural language is nested, also we can have string where expression in other programming language or natural language is nested and so on.

Also meta language itself can be much better quality, and should be readable closer to how most programming languages are structured, but more verbose and much more explicit. And also more general, as `print` should not be a special part, we should generalize it to what it actually is - call to some function and so on.

So we should be less specific and more generalized.

Also in list of programming languages I don't see assembly (with multiple versions/dialects - take most popular) and also I don't see intermediate languages from popular ecosystems like Java bytecode, .NET CIL and others.

We need to deeply rethink the quality, and everything that is not of the best possible quality should be updated.

Also we need to expand on supported cases/tasks from Rosetta Code, and making our grammar, parsers, emitters much more detailed and correct.

We also need to collect all previous not delivered requirements from all issues (description + comments), pull requests (description, comments). Everything that is not yet done must be fully tracked and fully done in this single pull request. We need to make sure that across the entire codebase we don't have undelivered requirements, and everything as perfect as it can be.

We should consult with best architecture of ANTLR, TreeSitter and others, spaCy https://spacy.io, [Stanza (Stanford NLP)](https://stanfordnlp.github.io/stanza/), [NLTK (Natural Language Toolkit)](https://www.nltk.org/), [Lark](https://github.com/lark-parser/lark), [GF (Grammatical Framework)](https://www.grammaticalframework.org/), and also https://opencog.github.io/link-grammar-website, and other similar projects.

Yet, we by default don't use AST, we use by default CST.

We also should remember our formal-ai, meta-language, router, relative-meta-logic, and other projects, in most of projects we should support translation 

We need to see core architecture, and make sure we support all the cases of these, so we can build our architecture in such a way, that we will support vast range of cases with no need to rewrite architecture at later stages so we don't need to rewrite it fully.

To make your work simpler you can use Haiku (low-high) and Sonnet (low-high) subagents, escalate with higher effort or from Haiku on Sonnet only if you see task you gave to subagent failed. You can also try to do some tasks for codechanges, discovery and so on https://github.com/link-assistant/formal-ai, if it fails report issues (as few as possible, grouping tasks which failed, with examples how other AI agents succeeded, for that you can use public gists (for sessions of subagents)).

We need to download all logs and data related about the issue to this repository, make sure we compile that data to `./docs/case-studies/issue-{id}` folder, and use it to do deep case study analysis (also make sure to search online for additional facts and data), in which we will reconstruct timeline/sequence of events, list of each and all requirements from the issue, find root causes of the each problem, and propose possible solutions and solution plans for each requirement (we should also check known existing components/libraries, that solve similar problem or can help in solutions).

If there is not enough data to find actual root cause, add debug output and verbose mode if not present, that will allow us to find root cause on next iteration.

If issue related to any other repository/project, where we can report issues on GitHub, please do so. Each issue must contain reproducible examples, workarounds and suggestions for fix the issue in code. Also double check to fully apply requirements to entire codebase, so if we have issue in multiple places, it should be fixed in all them.

Please plan and execute everything in this single pull request, you have unlimited time and context, as context auto-compacts and you can continue indefinitely, until it is each and every requirement fully addressed, and everything is totally done.

