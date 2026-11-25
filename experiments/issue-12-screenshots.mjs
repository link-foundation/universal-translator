// Issue 12: the "after" screenshots of docs/screenshots/issue-12 (all but
// the settings drawer). Run from examples/universal-app (where Playwright is
// installed), with its preview server on port 4173:
//   node ../../experiments/issue-12-screenshots.mjs [url] [folder]
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
const folder = process.argv[3] ?? '../../docs/screenshots/issue-12';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
});

const settings = (theme, editor) =>
  `#settings=(settings%20(version%201)%20(theme%20${theme})%20(editor%20${editor}))`;

const gcd = [
  'def gcd(a, b):',
  '    while b != 0:',
  '        t = b',
  '        b = a % b',
  '        a = t',
  '    return a',
  '',
  'print(gcd(48, 18))',
  '',
].join('\n');

async function shot(
  name,
  { width = 1280, scheme = 'light', hash = '', before, act }
) {
  const page = await browser.newPage({
    viewport: { width, height: 900 },
    colorScheme: scheme,
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  await page.goto(`${url}${hash}`);
  if (hash) {
    await page.reload();
  }
  await page.waitForSelector('#target-text');
  await before?.(page);
  await page.selectOption('#target-language', 'javascript');
  if (await page.$('#source-text .monaco-editor')) {
    await page.click('#source-text .view-lines');
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.press('Delete');
    // Pasted, as typing would indent every line again.
    await page.evaluate(
      (text) => globalThis.navigator.clipboard.writeText(text),
      gcd
    );
    await page.keyboard.press('ControlOrMeta+V');
  } else {
    await page.fill('#source-text', gcd);
  }
  // A plain pane holds the text; Monaco's pane keeps it in data-value.
  await page.waitForFunction(() => {
    const pane = globalThis.document.querySelector('#target-text');
    return (pane?.dataset.value ?? pane?.textContent ?? '').includes(
      'gcd(48, 18)'
    );
  });
  await act?.(page);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${folder}/${name}.png`, fullPage: true });
  console.log(`${folder}/${name}.png`);
  await page.close();
}

await shot('after-translate-light', {});
await shot('after-translate-dark', { scheme: 'dark' });
await shot('after-meta-light', {
  act: (page) => page.check('#show-meta'),
});
await shot('after-mobile', { width: 390 });
await shot('after-rules-tab', { act: (page) => page.click('#tab-rules') });
await shot('after-monaco-glass-dark', {
  scheme: 'dark',
  hash: settings('glass', 'monaco'),
  before: (page) =>
    page.waitForSelector('#source-text .monaco-editor', { timeout: 60000 }),
});
await browser.close();
