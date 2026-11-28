# 2: Rename @link-foundation/example-package-name to universal-translator before first publish

## Goal

Publish the package as `universal-translator`. The current manifest still uses the template name from the repository template.

## Current state

`package.json`:

- name: `@link-foundation/example-package-name`
- version: `0.11.31`
- bin: `example-package-name` -> `./bin/example-package-name.js`

## Requested change

1. Rename the npm package to `universal-translator`.
2. Rename the bin entry and its file to `universal-translator`.
3. Update examples, tests, README, release checks, and any `npm pack` assertions that mention `example-package-name`.
4. Keep the existing release workflow, but make sure it publishes the new name with OIDC trusted publishing.

## Acceptance criteria

- [ ] `npm view universal-translator version` succeeds after the release.
- [ ] `npx universal-translator --version` works.
- [ ] No reference to `@link-foundation/example-package-name` remains in the package metadata, docs, or release workflow.
- [ ] The first release is bootstrapped and the trusted publisher is attached for `link-foundation/universal-translator` and its release workflow.


