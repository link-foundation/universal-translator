---
'@link-foundation/universal-translator': minor
---

The free translation of comments and prose has better grammar. A verb form
keeps its slot: the languages that name their forms in
`data/natural/grammar.lino` (`verb-forms: lemma present`) write the present
form for a present form, so `Prints the sum` is `Печатает сумму` and no
longer `Печатать сумма`, and a finite form is never written as an
infinitive. The object of a verb takes the accusative in Russian,
Ukrainian and Polish (`object-endings`, `object-forms`), and in German and
Spanish for `someone` (`Greets someone` is `Приветствует кого-то`,
`Grüßt jemanden`, `Saluda a alguien`). In Russian, Ukrainian and Polish
`of` between two nouns is left out before a name the dictionary does not
know (`of-genitive`): `Returns the factorial of n` is
`Возвращает факториал n`. The vocabulary has many more everyday words
(greet, return, compute, calculate, count, add, sort, swap, move, increase,
decrease, divide, multiply, repeat, store, convert, compare, array,
element, digit, square, prime number) in twelve languages, and the rows of
a few verbs are put in the order lemma, present, past. The JavaScript and
Rust twins agree.
