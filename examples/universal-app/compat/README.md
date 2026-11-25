# Desktop dependency compatibility

The example app is developed and packaged with Node.js 24. electron-builder
and electron-winstaller used to install four deprecated packages, and every
`npm ci` of this app printed an `npm warn deprecated` line for each one:

| Deprecated package | Reached through                                         |
| ------------------ | ------------------------------------------------------- |
| `glob@7.2.3`       | electron-builder → app-builder-lib → `@electron/asar@3` |
| `inflight@1.0.6`   | the same `glob@7`                                       |
| `boolean@3.2.0`    | electron → `@electron/get` → `global-agent@3`           |
| `rimraf@2.6.3`     | electron-builder → electron-winstaller → `temp@0.9.4`   |

The scoped `overrides` in `../package.json` keep both packagers and remove
those chains. The same overrides are used by the
[JavaScript pipeline template](https://github.com/link-foundation/js-ai-driven-development-pipeline-template)
that this repository follows:

- `global-agent` ^4 no longer depends on `boolean`.
- `@electron/asar` 4.3.1 is a released ESM implementation. app-builder-lib
  loads it through a dynamic import, and electron-winstaller loads it through
  `require()`, which Node.js 24 supports for ESM.
- `minimatch@>=7 <11` and `glob@>=9 <=14.0.1` are raised past the
  GHSA-g3hv-75wg-m249 and GHSA-3g3m-2fjr-6pw4 advisories.
- `temp` gets the local `temp-rimraf` adapter described below.

`scripts/check-desktop-compat.mjs` runs the real consumers: app-builder-lib
packs an archive with packed and unpacked files, `@electron/asar` reads the
bytes back, app-builder-lib checks archive metadata, electron-winstaller is
imported, and temp's asynchronous and synchronous cleanup run. The Example
app workflow runs it with `--throw-deprecation` before packaging the app.
Remove an override when its consumer adopts a maintained version itself.

## Native cleanup adapter

Only `temp` 0.9.4 receives the `temp-rimraf` adapter. Its four cleanup calls
pass literal paths, use callback or synchronous removal and set
`maxBusyTries: 6`. The adapter maps these calls to Node's `fs.rm` and
`fs.rmSync`, with recursive removal, success on a missing path and bounded
retries on busy files.

This is a narrow adapter, not a general rimraf replacement. Glob patterns and
other rimraf options are not supported: unknown options and invalid retry
counts throw a `TypeError` before anything is deleted.
`js/tests/temp-cleanup.test.js` covers both APIs, bracket characters in
literal paths, missing paths and removing a symlink without its target.

## Checks

From the repository root, after `npm ci --prefix examples/universal-app`:

```bash
node --pending-deprecation --throw-deprecation scripts/check-desktop-compat.mjs
node --test js/tests/temp-cleanup.test.js js/tests/deprecated-packages.test.js
```

`js/tests/deprecated-packages.test.js` fails when any committed npm lockfile
contains a deprecated package; there is no allowlist. The Security workflow
also asks the npm registry about every locked version, because a package can
be deprecated after the lockfile was written.

Sources: [ASAR releases](https://github.com/electron/asar/releases),
[temp cleanup implementation](https://github.com/bruce/node-temp/blob/master/lib/temp.js),
[Node.js `fs.rm`](https://nodejs.org/docs/latest-v24.x/api/fs.html#fsrmpath-options-callback).
