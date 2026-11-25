// End-to-end check of the web demo in a real browser: every sample kind
// (statement, function, program, sentence) translates, the source language
// is detected by default, untranslatable parts are listed (or fail the
// whole text when all-or-nothing is on), rules added in the editor apply,
// and screenshots are saved for review.
//
// Usage: node examples/universal-app/e2e/translate.e2e.mjs <url> [screenshot.png]
import assert from 'node:assert/strict';

async function loadChromium() {
  try {
    return (await import('playwright')).chromium;
  } catch {
    return (await import('playwright-core')).chromium;
  }
}

const [url = 'http://127.0.0.1:4173/', screenshot] = process.argv.slice(2);
// The preview server may still be starting: wait up to a minute for it.
async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      if ((await fetch(url)).ok) {
        return;
      }
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`${url} did not answer within a minute`);
}

await waitForServer();
const chromium = await loadChromium();
// CHROMIUM_EXECUTABLE picks a browser when the installed one has another build.
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));

async function translation(from, to, source) {
  await page.selectOption('#source-language', from);
  await page.selectOption('#target-language', to);
  await page.fill('#source-text', source);
  const output = page.locator('#target-text, #target-error');
  await output.first().waitFor();
  return {
    text: await output.first().textContent(),
    failed: (await page.locator('#target-error').count()) > 0,
  };
}

try {
  await page.goto(url);
  await page.waitForSelector('#source-language option[value="python"]', {
    state: 'attached',
  });
  const ids = await page.$$eval('#source-language option', (options) =>
    options.map((option) => option.value)
  );
  assert.ok(ids.length >= 60, `only ${ids.length} languages are listed`);
  for (const id of [
    'javascript',
    'python',
    'rust',
    'english',
    'minimal-english',
  ]) {
    assert.ok(ids.includes(id), `${id} is not listed`);
  }

  const statement = await translation(
    'javascript',
    'python',
    'console.log("Hi");\n'
  );
  assert.equal(statement.failed, false, statement.text);
  assert.match(statement.text, /print\("Hi"\)/);

  const program = await translation(
    'rust',
    'go',
    'fn main() {\n    println!("{}", 6 * 7);\n}\n'
  );
  assert.equal(program.failed, false, program.text);
  assert.match(program.text, /fmt\.Println\(6 \* 7\)/);

  const sentence = await translation(
    'english',
    'javascript',
    'Write “Hello World!” and end the line.\n'
  );
  assert.equal(sentence.failed, false, sentence.text);
  assert.match(sentence.text, /console\.log\("Hello World!"\)/);

  // The source language is detected by default.
  await page.selectOption('#source-language', 'auto');
  await page.selectOption('#target-language', 'python');
  await page.fill('#source-text', 'console.log("Auto");\n');
  await page.waitForSelector('text=print("Auto")');
  assert.match(
    await page.locator('#source-language option[value="auto"]').textContent(),
    /Auto-detect \(javascript\)/
  );

  // Issue #8: Russian comparisons in words.
  await page.fill(
    '#source-text',
    'Если n меньше или равно 1, сделать это:\n  Ничего не делать\n'
  );
  await page.waitForSelector('text=if n <= 1:');

  // Partial translation keeps what translates and lists the rest.
  const partial = await translation(
    'python',
    'javascript',
    'x = 1\nwith open(f) as g:\n    y = 2\nprint(x)\n'
  );
  assert.equal(partial.failed, false, partial.text);
  assert.match(partial.text, /console\.log\(x\)/);
  assert.match(partial.text, /untranslated \(line 2\)/);
  assert.match(await page.locator('#untranslated').textContent(), /Line 2: /);
  if (screenshot) {
    await page.screenshot({
      path: screenshot.replace(/\.png$/u, '-partial.png'),
      fullPage: true,
    });
  }

  // A rule from the visual editor changes the translation.
  await page.click('#add-output');
  await page.fill('#rule-output-0-find', 'console.log');
  await page.fill('#rule-output-0-replace', 'print');
  await page.waitForSelector('#target-text:has-text("print(x)")');
  if (screenshot) {
    await page.screenshot({
      path: screenshot.replace(/\.png$/u, '-rules.png'),
      fullPage: true,
    });
  }
  await page.click('button[aria-label="Remove rule"]');
  await page.waitForSelector('#target-text:has-text("console.log(x)")');

  await page.check('#all-or-nothing');
  const broken = await translation(
    'javascript',
    'python',
    'function open(n) {\n  return n;\n'
  );
  assert.equal(
    broken.failed,
    true,
    `no error for an open function: ${broken.text}`
  );

  await page.uncheck('#all-or-nothing');
  await page.click('button:has-text("Function")');
  await page.selectOption('#target-language', 'rust');
  await page.locator('#target-text').waitFor();
  const functionText = await page.locator('#target-text').textContent();
  assert.match(functionText, /fn factorial/);
  // A function fragment stays a function: no program is wrapped around it.
  assert.doesNotMatch(functionText, /fn main/);
  assert.deepEqual(errors, []);
  if (screenshot) {
    await page.screenshot({ path: screenshot, fullPage: true });
  }
  console.log('The web demo translates statements, programs and sentences');
} finally {
  await browser.close();
}
