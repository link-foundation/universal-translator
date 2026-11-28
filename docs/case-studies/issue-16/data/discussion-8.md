# 8: Better translation quality

```
Если n меньше или равно 1, сделать это:
  Ничего не делать
```

```
Если n больше или равно 1, сделать это:
  Ничего не делать
```

These are not supported, as well as other obvious variations, we need to fix that.

We also need to make sure we can translate entire dataset of https://rosettacode.org/wiki/Category:Solutions_by_Programming_Task tasks, we should have algorithm to automatically load them all, sort by simplest meaning, and also support parsing mode, where we parse everything we can, except parts we cannot, so in such way we can calculate how many missing parts we have in the task's algorithm and so on.

We need to learn how to translate exactly everything we have in rosettacode.org finished tasks.

By supporting exactly all rosetta code cases, we can improve translation quality dramatically.

We also by default should translate everything we can translate and clearly mark parts we cannot translate with errors listed. So partial translation should be preferable by default. Yet we should still have everything configurable if user wants all or nothing mode.

We also need to make sure our system have ability to add additional configurable rules at each stage of translation. We also should have a visual editor for translation rules in our UI/UX demo on web pages.

Also in our UI/UX we should have ability to auto detect language by default, so it is easier for user to get translation to target language without selecting of source language.

We need to download all logs and data related about the issue to this repository, make sure we compile that data to `./docs/case-studies/issue-{id}` folder, and use it to do deep case study analysis (also make sure to search online for additional facts and data), in which we will reconstruct timeline/sequence of events, list of each and all requirements from the issue, find root causes of the each problem, and propose possible solutions and solution plans for each requirement (we should also check known existing components/libraries, that solve similar problem or can help in solutions).

If there is not enough data to find actual root cause, add debug output and verbose mode if not present, that will allow us to find root cause on next iteration.

If issue related to any other repository/project, where we can report issues on GitHub, please do so. Each issue must contain reproducible examples, workarounds and suggestions for fix the issue in code. Also double check to fully apply requirements to entire codebase, so if we have issue in multiple places, it should be fixed in all them.

Please plan and execute everything in this single pull request, you have unlimited time and context, as context auto-compacts and you can continue indefinitely, until it is each and every requirement fully addressed, and everything is totally done.

