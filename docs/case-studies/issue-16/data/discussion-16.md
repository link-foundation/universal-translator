# 16: Fixes and improvements

```
program
  function is-perfect (return-type boolean)
    parameter number (type integer)
    declaration sum (mutable true) (type integer)
      number 1 (type integer)
    declaration divisor (mutable true) (type integer)
      number 2 (type integer)
    while
      binary lessOrEqual (type boolean)
        binary multiply (type integer)
          name divisor (type integer)
          name divisor (type integer)
        name number (type integer)
      if
        binary equal (type boolean)
          binary remainder (type integer)
            name number (type integer)
            name divisor (type integer)
          number 0 (type integer)
        assignment sum (operator =)
          binary add (type integer)
            name sum (type integer)
            name divisor (type integer)
        if
          binary notEqual (type boolean)
            binary multiply (type integer)
              name divisor (type integer)
              name divisor (type integer)
            name number (type integer)
          assignment sum (operator =)
            binary add (type integer)
              name sum (type integer)
              binary divide (type integer)
                name number (type integer)
                name divisor (type integer)
      assignment divisor (operator =)
        binary add (type integer)
          name divisor (type integer)
          number 1 (type integer)
    return
      binary and (type boolean)
        binary greater (type boolean)
          name number (type integer)
          number 1 (type integer)
        binary equal (type boolean)
          name sum (type integer)
          name number (type integer)
```

We still have our meta language not explicit enough, for example we should carefully distinguish condition and action in while, if and others.

We also may need to use clear distinction between expressions and statements and so on. So it is clearly readable, and easy to distinguish and also maximally explicit.

<img width="1824" height="1139" alt="Screenshot 2026-11-26 at 1 30 41 PM" src="https://github.com/user-attachments/assets/fa22a66a-d440-4efe-b344-48f2e799ce0b" />

When we enable comments translation we immediately lose whitespace preservation, that must be fixed.

Not all languages support one to one lines and regions mapping and color coding. Which is nicely visualized between some programming languages. For example assembly languages, natural languages and so on.

Also comments and their translation are not always mapped one to one.

We should work hard on ability to make sure all our languages fully support all the features we have.

```
Определить является-простое через число:
  Если число меньше 2, сделать это:
    Вернуть ложь.
  Создать делитель со значением 2.
  Пока делитель умножить на делитель не больше число, повторять это:
    Если число по модулю делитель равно 0, сделать это:
      Вернуть ложь.
    Изменить делитель на делитель плюс 1.
  Вернуть истина.
```

We also need to support "согласованность слов" in all languages (when algorithms written as natural languages and comments), that do support these. For example:

`Вернуть истину.` instead `Вернуть истина.`, yet both `истина` and `истину` should reference to the same variable or constant and so on.

`не больше числа` instead of `не больше число`, and so on.


Sometimes mapping is not correct:

<img width="1824" height="1123" alt="Screenshot 2026-11-26 at 3 22 41 PM" src="https://github.com/user-attachments/assets/2c7a1a51-9110-44ab-9ace-78ec71fef461" />

`System.out.println("fibonacci(" + index + ") = " + fibonacci(index));` was not mapped to `fibonacci "$index" echo "fibonacci($index) = $REPLY"` visually.

We need to double check all the nuances, and and make sure we do them right.

Another example here shows that Russian translation of comments is not done fully:
<img width="1280" height="1004" alt="telegram-cloud-photo-size-2-5206501034757400504-y" src="https://github.com/user-attachments/assets/3b897591-8457-4225-9336-aade6f9cf277" />

For example `sequence` and `iteratively` was not translated to Russian.

Some translations have clearly a bug `**` is supported in JavaScript and was not translated to Python:

<img width="1684" height="548" alt="telegram-cloud-photo-size-2-5206499192216430645-w" src="https://github.com/user-attachments/assets/1ffccabd-15ab-4e58-8a14-6776f8cd3a71" />

We need to double check we support exactly all operators in all languages, as these are the most basic syntax constructions.

Translation of this fails:
```
@PostMapping
public ResponseEntity<UserDto> createUser(
        @RequestBody @Valid CreateUserRequest request) {

    UserDto user = userService.createUser(request);

    return ResponseEntity
            .status(HttpStatus.CREATED)
            .body(user);
}
```

We should have listed all similar projects to our project, so we can use all the best practices from them, and have automated grammar translations from their grammar format to our grammar format, which we can use to translate to our own code, so we can have combined and merged and modified if needed grammars for all languages, so we can programmatically convert their grammars to our grammar parser, and also have ability to get updates, and also use transformation before and after as needed, so we still have full control of resulting source code, and unified grammar and separate grammars, all work perfectly according to our needs.

By default automatic detection should select the most popular language in this case English, which is able to parse the expression:
<img width="520" height="592" alt="telegram-cloud-photo-size-2-5206499192216430646-x" src="https://github.com/user-attachments/assets/d424983f-f1be-4b35-ac1e-b4854ec6a110" />

So by choosing the most popular natural or programming language when auto detecting we are more likely to be correct.

<img width="520" height="592" alt="telegram-cloud-photo-size-2-5206499192216430646-x" src="https://github.com/user-attachments/assets/0bec2777-fa42-47fd-94b7-6665b10e9130" />

And here we have bug described as: `JS const array позволяет добавлять элементы а для Rust он должен быть mutable`, we need to double check we support all nuances of all languages perfectly.

And all features of all languages should be supported in all of them similarly.

<img width="1280" height="949" alt="telegram-cloud-photo-size-2-5206328583230530649-y" src="https://github.com/user-attachments/assets/b4fbba12-378c-4e23-8686-01135a4463d4" />

Here we clearly don't support translation.

```
import inspect

type(meaning)               # Что это за сущность по своей природе?
meaning.__doc__             # В чём её задуманное назначение?
inspect.getsource(meaning)  # Как именно она устроена и определена?
```

```
meaning??
```

May be we can use something like this or other way to ask similar question in python or any other language.

We should support questions translation. For example we can have SQL support also, and Linq expressions in C# and similar, as such query languages usually answer questions in most natural way.

We should deeply think about that here and support the best we can find about questions translation from natural language to programming languages.

```
int main(int argc, char** argv)
{
    try{
        int i=0;
        throw 8;
    }
    catch(int e)
    {
        return e;
    }
    return 0;
}
```

Translation of this C++ to other languages failed, also it detects as C, and on change to C++ it fails completely it fills the input (source) with errors, yet we should just change the language of translation in case auto-detect failed and we just switching to C++ in UI.

We also should go away from hardcoded templates, and do deep reasoning (algorithm) just enough to discover term and propose best possible translation.

We also need to use best practices from https://github.com/link-assistant/calculator regarding issues reporting, so it should be easy to click `Report issue` on bottom of the page and get prefilled issue on GitHub.

Also `Source code` link on bottom should be added to send user directly to GitHub repository.

Also for some reason we have strange highlight on the left near line numbers after they end, it looks scary and takes lots of attention to it:
<img width="1824" height="1123" alt="Screenshot 2026-11-26 at 5 38 58 PM" src="https://github.com/user-attachments/assets/4ff26f72-e90c-4cef-b58d-97c6499c9d39" />

We also need to collect all previous not delivered requirements from all issues (description + comments), pull requests (description, comments). Everything that is not yet done must be fully tracked and fully done in this single pull request. We need to make sure that across the entire codebase we don't have undelivered requirements, and everything as perfect as it can be.

We should consult with best architecture of ANTLR, TreeSitter and others, spaCy https://spacy.io/, [Stanza (Stanford NLP)](https://stanfordnlp.github.io/stanza/), [NLTK (Natural Language Toolkit)](https://www.nltk.org/), [Lark](https://github.com/lark-parser/lark), [GF (Grammatical Framework)](https://www.grammaticalframework.org/), and also https://opencog.github.io/link-grammar-website, and other similar projects.

Yet, we by default don't use AST, we use by default CST.

We also should remember our formal-ai, meta-language, router, relative-meta-logic, and other projects, in most of projects we should support translation

We need to see core architecture, and make sure we support all the cases of these, so we can build our architecture in such a way, that we will support vast range of cases with no need to rewrite architecture at later stages so we don't need to rewrite it fully.

To make your work simpler you can use Haiku (low-high) and Sonnet (low-high) subagents, escalate with higher effort or from Formal AI to Haiku to Sonnet only if you see task type you gave to subagent failed. You can also try to do some tasks for code changes, discovery and so on https://github.com/link-assistant/formal-ai, if it fails report issues (as few as possible, grouping tasks which failed, with examples how other AI agents succeeded, for that you can use public gists (for sessions of subagents)).

We need to download all logs and data related about the issue to this repository, make sure we compile that data to `./docs/case-studies/issue-{id}` folder, and use it to do deep case study analysis (also make sure to search online for additional facts and data), in which we will reconstruct timeline/sequence of events, list of each and all requirements from the issue, find root causes of the each problem, and propose possible solutions and solution plans for each requirement (we should also check known existing components/libraries, that solve similar problem or can help in solutions).

If there is not enough data to find actual root cause, add debug output and verbose mode if not present, that will allow us to find root cause on next iteration.

If issue related to any other repository/project, where we can report issues on GitHub, please do so. Each issue must contain reproducible examples, workarounds and suggestions for fix the issue in code. Also double check to fully apply requirements to entire codebase, so if we have issue in multiple places, it should be fixed in all them.

Please plan and execute everything in this single pull request, you have unlimited time and context, as context auto-compacts and you can continue indefinitely, until it is each and every requirement fully addressed, and everything is totally done.


