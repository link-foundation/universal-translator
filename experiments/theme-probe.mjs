/* global document, getComputedStyle */
// Prints the root attributes and the computed colors after a shared settings link.
import { chromium } from 'playwright-core';
const url = process.argv[2] ?? 'http://localhost:4173/';
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ??
    `${process.env.HOME}/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell`,
});
const page = await browser.newPage();
await page.goto(
  `${url}#settings=(settings%20(version%201)%20(theme%20glass)%20(scheme%20dark))`
);
await page.waitForTimeout(1500);
console.log(
  await page.evaluate(() => {
    const root = document.documentElement;
    const style = getComputedStyle(root);
    return {
      attrs: [...root.attributes].map((a) => `${a.name}=${a.value}`),
      surface: style.getPropertyValue('--color-surface'),
      styles: [...document.head.children].map(
        (e) => e.tagName + (e.id ? `#${e.id}` : '')
      ),
    };
  })
);
await browser.close();
