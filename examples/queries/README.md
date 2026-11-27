# Compositional selection queries

From the repository root, run:

```sh
node examples/queries/verify-native.mjs
```

The example requires Python 3 (with SQLite), Node and a .NET SDK. It uses four
records in memory and removes its temporary C# project afterward. The existing
native CI job executes the same check.

This selection returns `[19, 43]` in SQLite and its Python, JavaScript and C#
translations:

```sql
SELECT age + 1 FROM people AS person WHERE age >= 18 AND age < 65;
```

The data contains ages 12, 18, 42 and 70. C# materializes the SQL result with
`ToArray()`. A Python generator translates to deferred LINQ instead; changing the
second age to 21 leaves the materialized result at `[19, 43]` and changes the
subsequently enumerated result to `[22, 43]`.

The C# check also compiles complete generated functions with array and enumerable
return types, nested comprehensions, and a range variable that shadows a source
binding. The translator gives the C# range variable a distinct local name.

Current scope is a single relation, one projected expression (or `*`), and an
optional predicate over non-null records. Joins, grouping, ordering, SQL NULL
semantics, arbitrary object models and the remaining language families require
more implementation. Explicit SQL NULL expressions and deferred-to-SQL or
deferred-to-JavaScript translations report errors. JavaScript query output
requires ECMAScript 2015 or later.
