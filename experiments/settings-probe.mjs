// Prints how the settings panel shows its controls: the roles, labels and
// values the e2e test can drive.
import { chromium } from 'playwright-core';
const url = process.argv[2] ?? 'http://127.0.0.1:4173/';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
});
const page = await browser.newPage();
await page.goto(url);
await page.click('#settings-link');
await page.locator('#settings-panel').waitFor();
const glass = page.locator('#settings-panel ui-option[data-value="glass"]');
console.log('visible before', await glass.isVisible());
const box = page.locator('#settings-panel [role="combobox"]').first();
console.log(
  'comboboxes',
  await page.locator('#settings-panel [role="combobox"]').count(),
  await box.getAttribute('aria-label')
);
if (!(await glass.isVisible())) {
  await box.click();
}
console.log('visible after', await glass.isVisible());
await glass.click();
console.log(
  'theme',
  await page.getAttribute('html', 'data-theme'),
  await page.locator('#ui-theme').count()
);
await browser.close();
