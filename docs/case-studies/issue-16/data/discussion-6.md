# 6: Fixes and improvements

We should have an option to get meta language version of left and right language expression.

Also we if we change left translation we should not fail by default, that should mean we can use expression to the right to translate it to new selected language to the left.

Also button on tops should generate random example.

Meaning we should see supported algorithm types, select random of them, and 2 random languages (all supported natural and english) and show example.

We should put statement to the end, and remove sentence, as sentence is exactly the same as statement.

So we go with random examples on click for program, function, statement.

We also must support semantic primes (semantic meta language) as dictionary modifier for exactly all human languages.

For each language we should have different versions of it. 

For example for python we can have different major versions and may be some grammar variations, and for natural languages we can have biggest dictionary/vocabulary by default + variations like american/british and so on, with ability to downgrade. But we don't list lots of versions of English.

So we have only one python and one english (we also can match selection of american/british to selected user's languages in the browser).

We also should fully support multi language support, theme selection, skin update and so on (in UI settings - small link on the bottom of the page), so we have https://github.com/link-foundation/ui fully supported by default, so I can configure all details of the UI if I like to do so.

We also need to make sure we focus on supporting CST by default, that means we should our best to preserve whitespace as it is on both sides of the translation, including comments and whitespace inside comments.

We should also be able to select language not only of logic/code, but also language of comments, so we can have same code in same language, but translate only for comments and so on.

Think of all other edge cases, and double check we fully symmetrically support all the features across all the languages, support well known standards for all languages, not just English and so on.

We also should be able to edit every standard manually in separate tab/link/section, meaning it should be possible to see all the words we have, how they translate to meta language concepts and so on.

So if needed we can craft our own language standard, so if there any programming language missing we can take closest and adjust and save our own standard, each language standard should support up to 1024 or whatever the standard for example semantic primes are less than 100 words. We should check the biggest standard that is small enough, yet in each standard we should support recursive definitions of works and using words streamed/loaded/with cache + pre-cache for tests from wikidata, so we actually can extend our dictionary/vocabulary in real time (we should have universal algorithms for that) which will find our existing words in the standard and will recursively try to translate each unknown word's definition to these words, by recursively adding all missing words, each word will be fully defined, if it was successfully defined via words of our standard, so we can use that as introduction of new composite words on the fly, in real time.

We also need to double check all previous requirements of https://github.com/link-foundation/universal-translator/issues/1, that are fully delivered, and do all requirements that are not yet done, including this new updated vision.

We need to collect data related about the issue to this repository, make sure we compile that data to `./docs/case-studies/issue-{id}` folder, and use it to do deep case study analysis (also make sure to search online for additional facts and data), list of each and all requirements from the issue, and propose possible solutions and solution plans for each requirement (we should also check known existing components/libraries, that solve similar problem or can help in solutions).

Please plan and execute everything in this single pull request, you have unlimited time and context, as context auto-compacts and you can continue indefinitely, until each and every requirement fully addressed, and everything is totally done.


