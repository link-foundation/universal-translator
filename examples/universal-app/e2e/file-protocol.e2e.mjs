// The packaged desktop app opens dist/index.html from file://. There
// ui-themes used to read skin files through node:fs/promises, which Vite
// replaces with an empty module in a browser build, so choosing any skin
// failed with "readFile is not a function". This opens the built app the
// same way and checks that a skin's stylesheet is applied without errors.
//
// Usage (after `npm run example:web:build`):
//   node examples/universal-app/e2e/file-protocol.e2e.mjs [dist/index.html]
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

async function loadChromium() {
  try {
    return (await import('playwright')).chromium;
  } catch {
    return (await import('playwright-core')).chromium;
  }
}

const index = resolve(
  process.argv[2] || 'examples/universal-app/dist/index.html'
);
const chromium = await loadChromium();
// CHROMIUM_EXECUTABLE picks a browser when the installed one has another build.
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
  // Electron runs module scripts from file://; plain Chromium needs this.
  args: ['--allow-file-access-from-files'],
});
try {
  const page = await browser.newPage();
  const problems = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      problems.push(message.text());
    }
  });
  await page.goto(
    `${pathToFileURL(index).href}#settings=(settings%20(version%201)%20(theme%20glass))`
  );
  await page
    .waitForSelector('#ui-theme', { state: 'attached', timeout: 15000 })
    .catch((error) => {
      throw new Error(`No skin stylesheet: ${problems.join('; ')}`, {
        cause: error,
      });
    });
  assert.equal(await page.getAttribute('html', 'data-theme'), 'glass');
  assert.match(
    await page.locator('#ui-theme').textContent(),
    /--[\w-]+\s*:/,
    'the skin stylesheet defines custom properties'
  );
  assert.deepEqual(problems, []);
  console.log('The app built for the desktop loads a skin from file://');
} finally {
  await browser.close();
}
