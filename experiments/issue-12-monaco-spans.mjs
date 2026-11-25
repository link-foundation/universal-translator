// Issue 12: how Monaco renders the coloured tokens of a translated pane
// (span text, class and colour). Run from examples/universal-app (where
// Playwright is installed), with its preview server on port 4173:
//   node ../../experiments/issue-12-monaco-spans.mjs [url]
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(pathToFileURL(`${process.cwd()}/package.json`));
const load = async (name) =>
  await import(pathToFileURL(require.resolve(name)).href);
const playwright = await load('playwright').catch(() =>
  load('playwright-core')
);
const chromium = playwright.chromium ?? playwright.default.chromium;
const url = process.argv[2] ?? 'http://127.0.0.1:4173/';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
});
const page = await browser.newPage();
await page.goto(
  `${url}#settings=(settings%20(version%201)%20(theme%20app)%20(editor%20monaco))`
);
await page.reload();
await page.waitForSelector('#target-text .monaco-editor', { timeout: 60000 });
await page.waitForTimeout(1500);
// Type a text of its own in the source pane (the second argument).
if (process.argv[3]) {
  await page.click('#source-text .view-lines');
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(process.argv[3]);
  await page.waitForTimeout(1500);
  console.log(await page.getAttribute('#target-text', 'data-value'));
}
console.log(
  await page.$eval('#target-text .view-lines', (lines) =>
    [...lines.querySelectorAll('.view-line > span > span')].map((span) => [
      span.textContent,
      span.className,
      globalThis.getComputedStyle(span).color,
    ])
  )
);
await browser.close();
