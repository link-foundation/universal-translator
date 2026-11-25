// End-to-end check of the web demo in a real browser: every sample kind
// (statement, function, program, sentence) translates, an incomplete
// fragment shows an error, and a screenshot is saved for review.
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

  await page.click('button:has-text("Function")');
  await page.selectOption('#target-language', 'rust');
  await page.locator('#target-text').waitFor();
  assert.match(
    await page.locator('#target-text').textContent(),
    /fn factorial/
  );
  assert.deepEqual(errors, []);
  if (screenshot) {
    await page.screenshot({ path: screenshot, fullPage: true });
  }
  console.log('The web demo translates statements, programs and sentences');
} finally {
  await browser.close();
}
