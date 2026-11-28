# 12: Improve and polish the UI/UX and the entire codebase

<img width="1824" height="1122" alt="Screenshot 2026-11-25 at 5 12 00 PM" src="https://github.com/user-attachments/assets/0c51ae97-7ab9-46f7-9085-13e4b850d6cb" />
<img width="1824" height="1122" alt="Screenshot 2026-11-25 at 5 11 52 PM" src="https://github.com/user-attachments/assets/31d15457-5037-4490-a430-725ee594852f" />

We need to make sure our UI out of the box support different sizes of the content, for example in these screenshots we see that title and input boxes are jumping around all the time.

We also should support optional monaco editor with our custom highlighting of code based on our own meta language markup.

In all cases the height of left and right examples should be the same, so no jumping in UI/UX too much.

Also `How it works` block can be moved down to the page, so we have more usable space for source code in examples. So the code has more probability to fit horizontally.

We also need a way to turn on/off the word wrapping.

Rules must go to separate tab/section as language standards, so on the main page we can focus on translation examples.

All UI/UX elements must be carefully aligned.

We don't use JSON by default for rules or language standards or UI/UX settings, in all places - links notation in indented/nested form is preferred.

In meta language, we should use `x:` syntax only if we are sure something is unique or dictionary or duplicated section and so on, overwise we should prefer just regular nesting for example `body: block` looks crazy, it also strange that we have both body and block nested, do we really need or just block is enough? Or may be just nesting? Do we really need to explicitly mark blocks?

Double check all these and find best solution.

Double check that entire codebase works perfectly and we have no undelivered requirements left (the scope is entire repository and all previous issues and pull requests).

In UI/UX skins does not work, that is something strange. If https://github.com/link-foundation/ui or any other our dependency has bugs on missing features that must be reported.

We need to download all logs and data related about the issue to this repository, make sure we compile that data to `./docs/case-studies/issue-{id}` folder, and use it to do deep case study analysis (also make sure to search online for additional facts and data), in which we will reconstruct timeline/sequence of events, list of each and all requirements from the issue, find root causes of the each problem, and propose possible solutions and solution plans for each requirement (we should also check known existing components/libraries, that solve similar problem or can help in solutions).

If there is not enough data to find actual root cause, add debug output and verbose mode if not present, that will allow us to find root cause on next iteration.

If issue related to any other repository/project, where we can report issues on GitHub, please do so. Each issue must contain reproducible examples, workarounds and suggestions for fix the issue in code. Also double check to fully apply requirements to entire codebase, so if we have issue in multiple places, it should be fixed in all them.

Please plan and execute everything in this single pull request, you have unlimited time and context, as context auto-compacts and you can continue indefinitely, until it is each and every requirement fully addressed, and everything is totally done.

