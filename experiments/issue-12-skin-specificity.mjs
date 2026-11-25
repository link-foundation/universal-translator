// Issue 12, "skins don't work": a page with an app palette written the
// usual way (:root, and :root:not([data-scheme='light']) for the dark
// scheme) followed by the CSS of the glass skin from compileThemeCss.
// Each skin selector is [data-theme="glass"]:where(…), specificity (0,1,0),
// so the app's dark palette (0,2,0) wins whatever the order: the skin
// applies in the light scheme only. Scoping the app palette to its own skin
// (:root:not([data-theme]), [data-theme='app']) fixes it.
// Run from examples/universal-app: node ../../experiments/issue-12-skin-specificity.mjs
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(pathToFileURL(`${process.cwd()}/package.json`));
const load = async (name) =>
  await import(pathToFileURL(require.resolve(name)).href);
const playwright = await load('playwright').catch(() =>
  load('playwright-core')
);
const chromium = playwright.chromium ?? playwright.default.chromium;
const ui = (path) =>
  import(
    pathToFileURL(`${process.cwd()}/node_modules/@link-foundation/${path}`).href
  );
const { loadTheme } = await ui('ui-themes/src/index.js');
const { compileThemeCss } = await ui('ui-tokens/src/themes/index.js');
const skin = compileThemeCss(await loadTheme('glass'));

const palettes = {
  before: `:root { --color-surface: #f6f7f4; }
@media (prefers-color-scheme: dark) {
  :root:not([data-scheme='light']) { --color-surface: #141a18; }
}`,
  after: `:root:not([data-theme]), [data-theme='app'] { --color-surface: #f6f7f4; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]):not([data-scheme='light']),
  [data-theme='app']:not([data-scheme='light']) { --color-surface: #141a18; }
}`,
};

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
});
const page = await browser.newPage();
for (const [name, palette] of Object.entries(palettes)) {
  for (const colorScheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme });
    await page.setContent(
      `<html data-theme="glass" data-scheme="system"><head><style>${palette}</style><style>${skin}</style></head><body></body></html>`
    );
    const surface = await page.evaluate(() =>
      globalThis
        .getComputedStyle(globalThis.document.documentElement)
        .getPropertyValue('--color-surface')
        .trim()
    );
    console.log(`${name} ${colorScheme}: --color-surface ${surface}`);
  }
}
await browser.close();
