// A screenshot of the brace and indent pickers of the web demo: a
// JavaScript function written as C# with its braces on lines of their own
// and a two-space indent.
// Usage: node experiments/issue-14/style-screenshot.mjs <url> <screenshot.png>
import { chromium } from 'playwright-core';

const [url = 'http://127.0.0.1:4173/', file = 'style.png'] =
  process.argv.slice(2);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
await page.goto(
  `${url}#settings=(settings%20(version%201)%20(editor%20plain))`
);
await page.waitForSelector('#source-language option[value="python"]', {
  state: 'attached',
});
await page.selectOption('#source-language', 'javascript');
await page.selectOption('#target-language', 'csharp');
await page.uncheck('#fragment');
await page.fill(
  '#source-text',
  'function sign(a) {\n  if (a > 0) {\n    return 1;\n  } else {\n    return 0;\n  }\n}\n\nconsole.log(sign(5));\n'
);
await page.selectOption('#braces', 'next-line');
await page.selectOption('#indent', '2');
await page.waitForFunction(() =>
  globalThis.document
    .querySelector('#target-text')
    ?.textContent.includes('\n  {\n')
);
await page.screenshot({ path: file, fullPage: true });
console.log(await page.locator('#target-text').textContent());
await browser.close();
