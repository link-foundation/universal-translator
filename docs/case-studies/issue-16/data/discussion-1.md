# 1: A tool to do translation between languages

Hypothesis: translation in unrestricted grammars may be solved with dependent translation.

As we do in dependent logic in relative meta logic (when probability of single statement depends on probability of other statement, including recursively).

Translation changes depending on physical or abstract referent (or resolution of meaning of the word).

And sometimes multiple resolutions of meaning are intentional as in irony, paradoxes as so on.

All of paradoxes are links and fundamental laws, where we link something that is opposite or contradictory, but enviably connected.

So may there there is a way to deterministically translate between all languages, including natural languages.

We also need to make sure we precisely record any imprecision of any statement.

Like for example `person` is any person, `white person` is `any white person`, where `white` can reference anything white about that person, like `any person with a white skin` or `any person fully painted white` or `any person mostly white` and so on.

But as long as we make more concrete description the range of possible values gets smaller.

That means for example when we use associative model with type system defined as fractal like:
Type -> SubType
SubType -> SubType
SubType -> Value.

We actually still get type, subtype and value as types, but on each step we make them much more narrow.

So it looks like there should be one to one match between natural language and formal type system.

So we always work with ranges, and by calculating frequencies of language corpus we can have some probabilities which more specific type or description is most likely.

Yet for best translation (most likely and more correct) we should prefer such translation, which survives the round trip.

For example:

`белый` <-> `white`

`белый человек` <-> `white person`

In both languages these are highly likely.

And this example actually survives round trip, so that is the translation we should end up with using by default.

In programming language it may mean:

```
struct Person {
   Color color = Color.White;
}
```

And so on.

We also can see how Person is usually described on GitHub, and in the internet and so on, and if we have knowledge about corpus, we can have some probabilities on what to include.

We can also use the language description for requirements that will adjust requirements.

So when we define enough dependent details about anything in a language, we just specify a more concrete type, set or category.

That is the vision.

We should start by supporting full translation of something simple via meta language see best practices of https://github.com/link-foundation/meta-language

By simple I mean http://helloworldcollection.de, and https://rosettacode.org/wiki/Rosetta_Code

So once we take top 20-30 most used programming languages and support parsing all of them into meta language and back (basic roundtrip CST survival), we should also support translation from meta language expression to meta language expression, where we still in meta language, yet convert one abstraction to another (equivalent translation, with different levels of abstractions), yet at the same time we support exactly all concepts of each such language separately.

For example we can have function with no return value and no argument in both C, C#, C++ and so on, they match 1 to 1.

Yet we clearly have dependent expressions in languages, for example in `printf("Hello World!\n");` we have `printf` function depended on its import via `#include <stdio.h>`.

Yet effect of `printf("Hello World!\n");` is equivalent to effect of `System.Console.WriteLine("Hello, World!");`.

Yet main function C depends only on file, yet in C# function depends also on class.

So if we select configuration of translation as `same effect` we do `meta language` -> `meta language` translation/transformation first, and only after we translatated from C expression in `meta language` to equivalent expression  of C# `meta language` we can do materialization or formatting or translation from meta language to C#.

If `literal` translation configuration we can preserve source code comments, yet for example in `context dependent` translation we may also parse comments in natural language and transform them accordingly.

```
/* Hello world in C */

#include <stdio.h>

main()
{
    /* print "Hello World!" into console followed by new line symbol by function call */
    printf("Hello World!\n");
}
```

goes to

```
/* Hello World in C# */
class HelloWorld
{
    static void Main()
    {
        /* print "Hello World!" into console followed by new line symbol by method call */
        System.Console.WriteLine("Hello, World!");
    }
}
```

For example here we clearly updated the comment with C replaced to C#, `function call` -> `method call` and so on.

So by default we should use context dependent translation, with multiple configuration options like I described.

Once we finish with stabilization of translation between hello world programs, we should stabilize translation between all rosetta code examples.

We start by implementing our translator in JavaScript and Rust at the same time.

We should have just enough source code in both languages (we do manual translation first in this pull request), yet it should be perfect.

For that we should use our github.com/link-foundation/meta-language and github.com/link-foundation/relative-meta-logic and https://github.com/link-assistant/router/pull/775 to do general universal translation tool, yet our universal translator itself will be used in meta-language tooling, and relative-meta-logic tooling as well.

We should take bast practices from https://github.com/link-foundation/meta-language/pull/228, https://github.com/link-foundation/relative-meta-logic/pull/184 and https://github.com/link-assistant/router/pull/775, so we can create best possible and fully configurable universal translation core, it should have best possible architecture, with everything configurable, everything replaceable, decoratable (based on decorator pattern) and so on.

Yet in this pull request we focus on core architecture and simple hello world and rosetta code, we can modify examples in such a way, that we get the most perfect ones, which illustrate all our principles, so we have perfect examples we can build up on in top 20-30 languages, if any examples are missing in original we craft them perfectly. We focus on best possible readability - use full english words for functions/methods/variables and so on, and maximum simplicity, each algorithm should be correct in principle and work, but be as simple as possible, yet in such form that will be easy to translate between these.

We also should support multiple layers of translation rules.

Ideally in the future, it should be possible to prove that translation is equivalent in some narrow set of translation requirements, for example effect of code in programs in both languages can be the same.

Also it should be possible in future make full deep translation not only a code of application, but also the code of standard libraries and other libraries and so on.

Even if we only have binaries, we can still translate asm to C# CIL or Java ByteCode and so on (by the way we should also have these examples) for translation between different version of asm and CIL and byte code and so on, all again via meta language.

And we also can have an option to provide common library implementation, meaning we first implement library in both languages, translate C code to meta language, replace only function calls to common library implementation, check that it compiles, and runs exactly the same, after that we also use that common library and implement it C#, and after that we can simplify translation from C to C# via meta language by using common library, that means translation will be nearly line to line translation.

And so on, so I genuinely don't agree with impossibility of translation using only rules.

There also may be transformation/translation rules specific to repository/project/organization, we also may have translation or tranformation in the same language but changing only style or for example translate C# code and russian comments to C# code and English comments and so on. So there may be lots of configuration options as well as custom transformation/translation rules.

We also can change style when translating from one style of javascript to specific (non traditional) style of C# and so on.

So our architecture should use best of https://github.com/link-assistant/formal-ai/blob/main/docs/associative-tech-stack.md, and do it in the most extensible and configurable way, so it is always easy to extend/replace/workaround in any possible way.

We need to collect data related about the issue to this repository, make sure we compile that data to `./docs/case-studies/issue-{id}` folder, and use it to do deep case study analysis (also make sure to search online for additional facts and data), list of each and all requirements from the issue, and propose possible solutions and solution plans for each requirement (we should also check known existing components/libraries, that solve similar problem or can help in solutions).

Please plan and execute everything in this single pull request, you have unlimited time and context, as context auto-compacts and you can continue indefinitely, until each and every requirement fully addressed, and everything is totally done.






