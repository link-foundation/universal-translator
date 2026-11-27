// Generate a Playwright MCP browser_run_code_unsafe function on stdout.
// Only the translation/layout modules are served from the previous commit.
/* global document, requestAnimationFrame */
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

async function captureCommentWhitespace(page, { bodies, directory }) {
  const source =
    '\r\n# number\r\n\r\nn <- 1L\r\n# sequence\r\ncat(n + 2L, "\\n", sep = "")\r\n\r\n';
  const routes = [];
  for (const [path, body] of Object.entries(bodies)) {
    const pattern = `**/js/src/${path}*`;
    await page.route(pattern, (route) =>
      route.fulfill({ contentType: 'application/javascript', body })
    );
    routes.push(pattern);
  }
  async function display() {
    await page.goto(
      'http://localhost:5173/#settings=(settings%20(version%201)%20(theme%20app)%20(scheme%20dark)%20(editor%20monaco))'
    );
    await page.reload();
    await page.locator('#source-language').selectOption('r');
    await page.locator('#target-language').selectOption('bash');
    await page.locator('#comment-from').selectOption('english');
    await page.locator('#comment-language').selectOption('russian');
    await page.evaluate(async (text) => {
      const { loadMonaco } = await import('/src/monaco.js');
      const monaco = await loadMonaco();
      const editor = monaco.editor
        .getEditors()
        .find(
          (candidate) =>
            !candidate.getOption(monaco.editor.EditorOption.readOnly)
        );
      editor.setValue(text);
    }, source);
    await page.waitForFunction(
      () =>
        document
          .querySelector('#target-text')
          ?.dataset.value.includes('последовательность'),
      undefined,
      { timeout: 10000 }
    );
    // Monaco paints after the translation dataset is updated.
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve))
        )
    );
    return page.locator('#target-text').getAttribute('data-value');
  }
  const before = await display();
  if (!/# число\r?\nn=/.test(before)) {
    throw new Error(`Not reproduced: ${before}`);
  }
  await page.screenshot({
    path: `${directory}/comment-whitespace-before.png`,
    scale: 'css',
    fullPage: true,
  });
  for (const pattern of routes) {
    await page.unroute(pattern);
  }
  const after = await display();
  if (!/# число\r?\n\r?\nn=/.test(after)) {
    throw new Error(`Not fixed: ${after}`);
  }
  await page.screenshot({
    path: `${directory}/comment-whitespace-after.png`,
    scale: 'css',
    fullPage: true,
  });
  return { before, after };
}

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = fileURLToPath(
  new URL('../docs/screenshots/issue-16/', import.meta.url)
);
mkdirSync(directory, { recursive: true });
const bodies = Object.fromEntries(
  ['translator.js', 'translation/layout.js'].map((path) => [
    path,
    execFileSync('git', ['show', `eeb793d:js/src/${path}`], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 256 * 1024,
    }),
  ])
);
console.log(
  `async (page) => { const capture = ${captureCommentWhitespace}; return capture(page, ${JSON.stringify({ bodies, directory })}); }`
);
