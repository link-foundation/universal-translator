// Smoke check of the example app: errors on load, the pickers, meta view,
// random examples, settings panel, theme loading, standards tab.
import { chromium } from 'playwright-core';
const url = process.argv[2] ?? 'http://127.0.0.1:4173/';
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ??
    `${process.env.HOME}/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell`,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on(
  'console',
  (m) => m.type() !== 'log' && errors.push(`${m.type()}: ${m.text()}`)
);
await page.goto(url);
await page.waitForSelector('#target-text, #target-text-error');
console.log('target:', await page.locator('#target-text').textContent());
console.log(
  'source langs:',
  await page.locator('#source-language option').count()
);
await page.selectOption('#source-language', 'english');
console.log(
  'english version:',
  await page.inputValue('#source-version'),
  'source:',
  await page.inputValue('#source-text')
);
await page.check('#show-meta');
console.log(
  'meta:',
  (await page.locator('#source-meta').textContent()).slice(0, 120)
);
await page.click('button[data-kind="Function"]');
console.log(
  'example:',
  await page.locator('#example-note').textContent(),
  await page.inputValue('#source-language'),
  await page.inputValue('#target-language')
);
await page.click('#settings-link');
await page.waitForTimeout(300);
console.log(
  'panel visible:',
  await page.locator('#settings-panel').isVisible()
);
await page.screenshot({ path: '/tmp/smoke-settings.png' });
await page.goto(
  `${url}#settings=(settings%20(version%201)%20(theme%20glass)%20(scheme%20dark)%20(locale%20ru))`
);
await page.reload();
await page.waitForTimeout(1500);
console.log(
  'theme style:',
  await page.locator('#ui-theme').count(),
  await page.getAttribute('html', 'data-theme'),
  await page.getAttribute('html', 'lang')
);
console.log('title ru:', await page.locator('h1').textContent());
await page.screenshot({ path: '/tmp/smoke-glass.png' });
await page.click('#tab-standards');
await page.waitForSelector('#vocabulary');
console.log(
  'vocab rows:',
  await page.locator('#vocabulary tbody tr').count(),
  'size:',
  await page.locator('#standard-size').textContent()
);
await page.screenshot({ path: '/tmp/smoke-standards.png', fullPage: true });
console.log('errors:', errors);
await browser.close();
