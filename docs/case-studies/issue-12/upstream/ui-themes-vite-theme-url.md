# ui-themes: loadTheme() fails in a Vite build because readThemeFile's URL is a template literal

Reported upstream: https://github.com/link-foundation/ui/issues/292

Source: link-foundation/ui main (3d556e7), published `@link-foundation/ui-themes@0.2.0`.
Consumer: link-foundation/universal-translator web demo (React 18, Vite 6.4.6).

## What happens

`readThemeFile` in `packages/ui-themes/src/mapping.js` builds its URL with a template literal:

```js
const url = new URL(`../themes/${path}`, import.meta.url);
```

Vite treats `new URL(<template literal>, import.meta.url)` as an asset glob
(https://vite.dev/guide/assets.html#new-url-url-import-meta-url) and turns the
dynamic part into a `*` of **one** directory level: `../themes/*`. No theme file
sits directly in `themes/` (they are `themes/material3/colors.lino`,
`themes/classic/konard/glass.lino`, …), so the glob is empty and the production
bundle contains:

```js
async function GR(e){const n=new URL(Object.assign({})[`../themes/${e}`],import.meta.url); … }
```

Every theme is fetched from `…/assets/undefined` and `loadTheme(id)` rejects with
`Cannot load theme data: 404 …`. The theme files are not emitted into `dist/` either.

## Reproduction

1. A Vite app that calls `loadTheme('glass')` from `@link-foundation/ui-themes`.
2. `vite build` and serve `dist/`.
3. `loadTheme` rejects; the bundle contains `Object.assign({})[\`../themes/${e}\`]`.

Script: https://github.com/link-foundation/universal-translator/blob/35fca8d5b993d5b4146d6b7aaba3a71070556efe/experiments/issue-12-vite-theme-url.mjs
(builds the demo without its workaround and prints the compiled `readThemeFile`).

## Workaround used by the consumer

A `pre` Vite transform rewrites the expression to a string concatenation, which
Vite leaves alone, and the `themes/` folder is copied next to the bundle:

```js
code.replace(
  'new URL(`../themes/${path}`, import.meta.url)',
  "new URL('../themes/' + path, import.meta.url)"
);
// writeBundle: cpSync(node_modules/@link-foundation/ui-themes/themes, `${dir}/themes`)
```

(https://github.com/link-foundation/universal-translator/blob/35fca8d5b993d5b4146d6b7aaba3a71070556efe/examples/universal-app/vite.config.js)

## Suggested fix

- Build the URL in a way bundlers do not rewrite, e.g.
  `new URL('../themes/' + path, import.meta.url)` or
  `new URL(path, new URL('../themes/', import.meta.url))`, and document that the
  `themes/` folder has to be served next to the module; or
- Better for bundlers: make every theme loadable through a static import map
  (`import.meta.glob('../themes/**/*.lino', { query: '?raw' })` is Vite-only, so
  rather a generated `themes/index.js` with `() => import('./classic/konard/glass.lino.js')`
  entries holding the text), so bundlers emit only the chosen themes.
- Add an external Vite production-build smoke test that calls `loadTheme` (as asked
  for the inspector assets in #212).
