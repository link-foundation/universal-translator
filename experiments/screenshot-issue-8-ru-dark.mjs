// Screenshot of the web demo in Russian with the dark scheme, showing the
// detected source language, the untranslated parts and the rules editor.
// Usage: node experiments/screenshot-issue-8-ru-dark.mjs <url> <file.png>
const { chromium } = await import('playwright');
const [url = 'http://127.0.0.1:4173/', file = 'ru-dark.png'] =
  process.argv.slice(2);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(
  `${url}#settings=(settings%20(version%201)%20(theme%20app)%20(scheme%20dark)%20(locale%20ru))`
);
await page.reload();
await page.waitForSelector('#source-language option[value="python"]', {
  state: 'attached',
});
await page.fill(
  '#source-text',
  'x = 1\nwith open(f) as g:\n    y = 2\nprint(x)\n'
);
await page.selectOption('#target-language', 'javascript');
await page.waitForSelector('#untranslated');
await page.click('#add-names');
await page.fill('#rule-names-0-find', 'x');
await page.fill('#rule-names-0-replace', 'count');
await page.waitForSelector('#target-text:has-text("count")');
console.log(
  await page.locator('#source-language option[value="auto"]').textContent()
);
console.log(await page.locator('#untranslated').textContent());
await page.screenshot({ path: file, fullPage: true });
await browser.close();
