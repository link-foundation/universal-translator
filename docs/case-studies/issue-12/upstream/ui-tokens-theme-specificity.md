# ui-tokens: compiled theme CSS loses to a host's dark palette (skins apply in the light scheme only)

Reported upstream: https://github.com/link-foundation/ui/issues/293

Source: link-foundation/ui main (3d556e7), published `@link-foundation/ui-tokens@0.1.0`,
`@link-foundation/ui-themes@0.2.0`.
Consumer: link-foundation/universal-translator web demo.

## What happens

`compileThemeCss(theme)` writes every rule as
`[data-theme="glass"]:where(<scheme/contrast/motion selectors>)`. Because of `:where()`
each rule has the specificity of one attribute, (0,1,0).

An app usually has its own palette for when no skin is chosen, written the common way:

```css
:root {
  --color-surface: #f6f7f4;
} /* (0,1,0) */
@media (prefers-color-scheme: dark) {
  :root:not([data-scheme='light']) {
    --color-surface: #141a18;
  } /* (0,2,0) */
}
```

In the light scheme the skin wins only by source order (its `<style>` comes later).
In the dark scheme the host rule has (0,2,0) and wins whatever the order, so a skin
seems to "not work" in dark mode: `data-theme="glass"` is set and the skin's
stylesheet is loaded, but `--color-surface` stays the app's `#141a18` instead of
glass' `#0b1626`.

## Reproduction

https://github.com/link-foundation/universal-translator/blob/35fca8d5b993d5b4146d6b7aaba3a71070556efe/experiments/issue-12-skin-specificity.mjs
loads the glass theme, compiles it and puts it after such a palette in Chromium:

```
before light: --color-surface #e9f2fa
before dark: --color-surface #141a18   <- the app's palette, not the skin
after light: --color-surface #e9f2fa
after dark: --color-surface #0b1626
```

## Workaround used by the consumer

Scope the app's palette to "no skin or the app's own skin":

```css
:root:not([data-theme]), [data-theme='app'] { … }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]):not([data-scheme='light']),
  [data-theme='app']:not([data-scheme='light']) { … }
}
```

## Suggested fix

- Document in ui-themes/ui-tokens how a host palette must be written next to a
  compiled theme (scoped as above, or inside a lower cascade layer, or with `:where()`).
- Optionally let `compileThemeCss(theme, { layer: 'theme' })` wrap its output in
  `@layer`, so a host can order `@layer app-defaults, theme;` and never depend on
  specificity or on the order of `<style>` elements.
- A browser test with a host palette that has a dark-scheme rule.
