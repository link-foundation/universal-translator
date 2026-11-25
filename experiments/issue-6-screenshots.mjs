// Screenshots of the issue 6 features of the web demo, for the case study
// and the pull request: translation with versions and the meta language,
// the Standards tab, the settings panel and the interface in Russian.
//
//   node experiments/issue-6-screenshots.mjs [url] [directory]
async function loadChromium() {
  try {
    return (await import('playwright')).chromium;
  } catch {
    return (await import('playwright-core')).chromium;
  }
}
const chromium = await loadChromium();

const [url = 'http://127.0.0.1:4173/', out = 'docs/screenshots/issue-6'] =
  process.argv.slice(2);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
});
const page = await browser.newPage({
  viewport: { width: 1280, height: 900 },
  locale: 'en-GB',
});
const shot = (name) =>
  page.screenshot({ path: `${out}/${name}.png`, fullPage: true });

try {
  await page.goto(`${url}?seed=7`);
  await page.waitForSelector('#source-language option[value="python"]', {
    state: 'attached',
  });
  await page.selectOption('#source-language', 'javascript');
  await page.selectOption('#target-language', 'python');
  await page.fill(
    '#source-text',
    '// say hello\nfunction greet(name) {\n  //   keep the spaces\n  console.log("Hello, " + name);\n}\n\ngreet("World");  // trailing\n'
  );
  await page.locator('#target-text').waitFor();
  await shot('translate');
  await page.check('#show-meta');
  await page.locator('#source-meta').waitFor();
  await shot('meta-language');
  await page.uncheck('#show-meta');
  await page.selectOption('#target-version', 'python@2');
  await page.selectOption('#comment-language', 'russian');
  await page.locator('#target-text').waitFor();
  await shot('versions-and-comment-language');

  await page.click('#tab-standards');
  await page.waitForSelector('#vocabulary');
  await page.fill('#vocabulary-filter', 'print');
  await page.locator('#vocabulary textarea').first().fill('say');
  await page.fill('#standard-name', 'Spoken Python');
  await page.click('#save-standard');
  await page.fill('#new-word', 'twice');
  await page.click('#define-word');
  await page.locator('#word-status').waitFor();
  await shot('standards');

  await page.click('#tab-translate');
  await page.click('#settings-link');
  const panel = page.locator('#settings-panel');
  await panel.waitFor();
  await panel.locator('[role="combobox"]').first().click();
  await panel.locator('ui-option[data-value="glass"]').click();
  await page.waitForSelector('#ui-theme', { state: 'attached' });
  await page.waitForTimeout(300);
  await shot('settings');

  await page.goto(
    `${url}#settings=(settings%20(version%201)%20(theme%20app)%20(scheme%20dark)%20(locale%20ru))`
  );
  await page.reload();
  await page.waitForFunction(
    () => globalThis.document.documentElement.lang === 'ru'
  );
  await page.waitForSelector('#source-language option[value="python"]', {
    state: 'attached',
  });
  await shot('russian-dark');
  console.log(`screenshots written to ${out}`);
} finally {
  await browser.close();
}
