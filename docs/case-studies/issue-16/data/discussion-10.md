# 10: Check for all false positives, false negatives, warnings and errors in CI/CD and fix them all

### Recent CI/CD runs on `main`

| Workflow | Status | Conclusion | Commit | Run |
| --- | --- | --- | --- | --- |
| Example app | completed | failure | `5fda311` | [run](https://github.com/link-foundation/universal-translator/actions/runs/45623028339) |
| Checks and release | completed | success | `5fda311` | [run](https://github.com/link-foundation/universal-translator/actions/runs/45623028403) |
| Security | completed | success | `5fda311` | [run](https://github.com/link-foundation/universal-translator/actions/runs/45623028311) |
| Broken Link Checker | completed | success | `5fda311` | [run](https://github.com/link-foundation/universal-translator/actions/runs/45623028282) |
| Workflows | completed | success | `7813145` | [run](https://github.com/link-foundation/universal-translator/actions/runs/45565052314) |

Use all the best practices from CI/CD templates (check full file tree to compare for all GitHub workflow and CI/CD scripts file), if the same issue is found in template report issue also in templates:

- https://github.com/link-foundation/js-ai-driven-development-pipeline-template
- https://github.com/link-foundation/rust-ai-driven-development-pipeline-template
- https://github.com/link-foundation/python-ai-driven-development-pipeline-template
- https://github.com/link-foundation/cpp-ai-driven-development-pipeline-template
- https://github.com/link-foundation/java-ai-driven-development-pipeline-template
- https://github.com/link-foundation/csharp-ai-driven-development-pipeline-template
- https://github.com/link-foundation/go-ai-driven-development-pipeline-template
- https://github.com/link-foundation/php-ai-driven-development-pipeline-template

We should compare all files, so we don't have more CI/CD errors in the future and reuse all the best practices from these templates.

Follow the CI/CD best practices collected in [https://github.com/link-assistant/hive-mind/blob/main/docs/CI-CD-BEST-PRACTICES.md](https://github.com/link-assistant/hive-mind/blob/main/docs/CI-CD-BEST-PRACTICES.md).

Please plan and execute everything in this single pull request, you have unlimited time and context, as context auto-compacts and you can continue indefinitely, until it is each and every requirement fully addressed, and everything is totally done.

---

<details>
<summary>Context collected by <code>/fix --ci-cd</code></summary>

- **Repository:** [link-foundation/universal-translator](https://github.com/link-foundation/universal-translator)
- **Default branch:** `main`
- **Latest commit:** `5709e6b` ([commit](https://github.com/link-foundation/universal-translator/commit/5709e6b17e85d19fb118db2cf05af531d66a269d)) — 0.14.0
- **CI/CD runs found:** 5 (1 not passing)

**Detected languages**

- **JavaScript** — 58.1%
- **Rust** — 37.3%
- **Python** — 2.2%
- **Shell** — 1.9%
- **Ada** — 0.0%
- **Zig** — 0.0%
- **Fortran** — 0.0%
- **Dockerfile** — 0.0%
- **Rocq Prover** — 0.0%
- **TypeScript** — 0.0%
- **Pascal** — 0.0%
- **Java** — 0.0%
- **C** — 0.0%
- **Lean** — 0.0%
- **C#** — 0.0%
- **Visual Basic .NET** — 0.0%
- **Lua** — 0.0%
- **C++** — 0.0%
- **Objective-C** — 0.0%
- **MATLAB** — 0.0%
- **Groovy** — 0.0%
- **Scala** — 0.0%
- **Swift** — 0.0%
- **Dart** — 0.0%
- **Go** — 0.0%
- **R** — 0.0%
- **Perl** — 0.0%
- **D** — 0.0%
- **Ruby** — 0.0%
- **PHP** — 0.0%
- **Kotlin** — 0.0%
- **Nim** — 0.0%
- **Julia** — 0.0%

**Recommended CI/CD templates**

Apply the best practices from these templates, in priority order (most-used language first):

1. **JavaScript / TypeScript** — [link-foundation/js-ai-driven-development-pipeline-template](https://github.com/link-foundation/js-ai-driven-development-pipeline-template) _(detected: JavaScript, TypeScript)_
2. **Rust** — [link-foundation/rust-ai-driven-development-pipeline-template](https://github.com/link-foundation/rust-ai-driven-development-pipeline-template) _(detected: Rust)_
3. **Python** — [link-foundation/python-ai-driven-development-pipeline-template](https://github.com/link-foundation/python-ai-driven-development-pipeline-template) _(detected: Python)_
4. **C / C++** — [link-foundation/cpp-ai-driven-development-pipeline-template](https://github.com/link-foundation/cpp-ai-driven-development-pipeline-template) _(detected: C, C++)_
5. **Java** — [link-foundation/java-ai-driven-development-pipeline-template](https://github.com/link-foundation/java-ai-driven-development-pipeline-template) _(detected: Java)_
6. **C#** — [link-foundation/csharp-ai-driven-development-pipeline-template](https://github.com/link-foundation/csharp-ai-driven-development-pipeline-template) _(detected: C#)_
7. **Go** — [link-foundation/go-ai-driven-development-pipeline-template](https://github.com/link-foundation/go-ai-driven-development-pipeline-template) _(detected: Go)_
8. **PHP** — [link-foundation/php-ai-driven-development-pipeline-template](https://github.com/link-foundation/php-ai-driven-development-pipeline-template) _(detected: PHP)_

Other detected languages without a dedicated template: Shell, Ada, Zig, Fortran, Dockerfile, Rocq Prover, Pascal, Lean, Visual Basic .NET, Lua, Objective-C, MATLAB, Groovy, Scala, Swift, Dart, R, Perl, D, Ruby, Kotlin, Nim, Julia.

</details>

