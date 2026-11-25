// End-to-end check of the web demo in a real browser: translations between
// languages and their versions, the left language changing with the text
// said in it, the meta language of both texts, random examples (program,
// function, statement), the comment language, the Standards tab (a
// vocabulary saved as a standard of one's own, words defined through other
// words), the settings panel (skin, scheme, interface language), the source
// language detected by default, untranslatable parts listed (or failing the
// whole text when all-or-nothing is on) and rules from the editor applied.
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
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  locale: 'en-GB',
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));

const output = () => page.locator('#target-text, #target-text-error').first();

// A language of the picker on one side, and one of its versions.
async function choose(side, language, version) {
  await page.selectOption(`#${side}-language`, language);
  if (version) {
    await page.selectOption(`#${side}-version`, version);
  }
}

async function translation(from, to, source) {
  await choose('source', ...[from].flat());
  await choose('target', ...[to].flat());
  await page.fill('#source-text', source);
  await output().waitFor();
  return {
    text: await output().textContent(),
    failed: (await page.locator('#target-text-error').count()) > 0,
  };
}

async function translatesBetweenVersions() {
  const ids = await page.$$eval('#source-language option', (options) =>
    options.map((option) => option.value)
  );
  assert.ok(ids.length >= 60, `only ${ids.length} languages are listed`);
  for (const id of ['javascript', 'python', 'rust', 'english']) {
    assert.ok(ids.includes(id), `${id} is not listed`);
  }
  // One entry per language: versions are chosen next to it.
  assert.ok(!ids.includes('minimal-english'), 'versions are listed apart');

  const statement = await translation(
    'javascript',
    'python',
    'console.log("Hi");\n'
  );
  assert.equal(statement.failed, false, statement.text);
  assert.match(statement.text, /print\("Hi"\)/);
  const python2 = await translation(
    'javascript',
    ['python', 'python@2'],
    'console.log("Hi");\n'
  );
  assert.match(python2.text, /print "Hi"/);

  const program = await translation(
    'rust',
    'go',
    'fn main() {\n    println!("{}", 6 * 7);\n}\n'
  );
  assert.equal(program.failed, false, program.text);
  assert.match(program.text, /fmt\.Println\(6 \* 7\)/);

  // The browser asks for British English: it is the version chosen.
  await choose('source', 'english');
  assert.equal(await page.inputValue('#source-version'), 'english-british');
  const sentence = await translation(
    ['english', 'english'],
    'javascript',
    'Write “Hello World!” and end the line.\n'
  );
  assert.equal(sentence.failed, false, sentence.text);
  assert.match(sentence.text, /console\.log\("Hello World!"\)/);

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
}

// The source language is detected by default, parts that cannot be
// translated are listed, and rules from the visual editor apply.
async function detectsAndTranslatesPartially() {
  await page.selectOption('#source-language', 'auto');
  await choose('target', 'python');
  await page.fill('#source-text', 'console.log("Auto");\n');
  await page.waitForSelector('text=print("Auto")');
  assert.match(
    await page.locator('#source-language option[value="auto"]').textContent(),
    /Auto-detect \(JavaScript\)/
  );

  // Russian comparisons in words.
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
  await page.click('button[data-action="remove-rule"]');
  await page.waitForSelector('#target-text:has-text("console.log(x)")');
}

async function changesTheLeftLanguage() {
  await translation('javascript', 'python', 'console.log("Hi");\n');
  // The text on the left is said in the new language, nothing fails.
  await choose('source', 'rust');
  assert.match(await page.inputValue('#source-text'), /println!\("Hi"\)/);
  await output().waitFor();
  assert.equal(await page.locator('#target-text-error').count(), 0);
  await choose('source', 'english', 'english');
  assert.match(await page.inputValue('#source-text'), /Hi/);
  assert.equal(await page.locator('#target-text-error').count(), 0);
}

async function showsTheMetaLanguage() {
  await translation('javascript', 'python', 'console.log("Hi");\n');
  await page.check('#show-meta');
  const source = await page.locator('#source-meta').textContent();
  const target = await page.locator('#target-meta').textContent();
  assert.match(source, /^program/);
  assert.match(source, /^    text Hi \(type text\)$/m);
  assert.doesNotMatch(source, /\bblock\b|\w:/, 'plain nesting, no labels');
  assert.equal(target, source, 'one meaning on both sides');
  await page.uncheck('#show-meta');
}

async function writesCommentsInAnotherLanguage() {
  await translation(
    'javascript',
    'python',
    '// say hello\nconsole.log("Hi");\n'
  );
  assert.match(await output().textContent(), /# say hello/);
  await page.selectOption('#comment-language', 'russian');
  await page.locator('#target-text').waitFor();
  const text = await page.locator('#target-text').textContent();
  assert.match(text, /print\("Hi"\)/);
  assert.doesNotMatch(text, /say hello/);
  await page.selectOption('#comment-language', '');
}

async function showsRandomExamples() {
  for (const kind of ['Program', 'Function', 'Statement']) {
    await page.click(`button[data-kind="${kind}"]`);
    const note = await page.locator('#example-note').textContent();
    assert.match(note, new RegExp(kind === 'Statement' ? 'Statement' : kind));
    assert.notEqual(await page.inputValue('#source-text'), '');
    await output().waitFor();
    assert.equal(
      await page.locator('#target-text-error').count(),
      0,
      `${kind}: ${await output().textContent()}`
    );
  }
  assert.equal(await page.locator('button[data-kind="Sentence"]').count(), 0);
}

async function savesAStandard() {
  await page.click('#tab-standards');
  await page.waitForSelector('#vocabulary');
  await page.fill('#vocabulary-filter', 'print');
  const field = page.locator('#vocabulary textarea').first();
  await field.fill('say');
  await page.fill('#standard-name', 'Spoken Python');
  await page.click('#save-standard');
  const status = await page.locator('#standard-status').textContent();
  assert.match(status, /python@spoken-python/);
  assert.match(
    await page.locator('#saved-standards').textContent(),
    /Spoken Python/
  );

  // A word defined from the pre-cached Wikidata definitions.
  const before = await page.locator('#standard-size').textContent();
  await page.fill('#new-word', 'twice');
  await page.click('#define-word');
  await page.locator('#word-status').waitFor();
  assert.notEqual(await page.locator('#standard-size').textContent(), before);
  assert.match(await page.locator('#composite-words').textContent(), /twice/);

  // The saved standard is a version of Python on the translate tab.
  await page.click('#saved-standards button >> nth=0');
  await page.waitForSelector('#source-version');
  assert.equal(
    await page.inputValue('#source-version'),
    'python@spoken-python'
  );
  await page.fill('#source-text', 'say("Hi")\n');
  await choose('target', 'javascript');
  assert.match(await output().textContent(), /console\.log\("Hi"\)/);
}

async function changesTheSettings() {
  await page.click('#settings-link');
  const panel = page.locator('#settings-panel');
  await panel.waitFor();
  // The skin is the first choice: a listbox of @link-foundation/ui-components.
  await panel.locator('[role="combobox"]').first().click();
  await panel.locator('ui-option[data-value="glass"]').click();
  await page.waitForSelector('#ui-theme', { state: 'attached' });
  assert.equal(await page.getAttribute('html', 'data-theme'), 'glass');
  await page.reload();
  // Saved for the next visit.
  await page.waitForSelector('#ui-theme', { state: 'attached' });
  await page.goto(
    `${url}#settings=(settings%20(version%201)%20(theme%20app)%20(scheme%20dark)%20(locale%20ru))`
  );
  await page.reload();
  await page.waitForFunction(
    () => globalThis.document.documentElement.lang === 'ru'
  );
  assert.equal(await page.locator('#tab-translate').textContent(), 'Перевод');
  assert.equal(await page.getAttribute('html', 'data-scheme'), 'dark');
}

try {
  await page.goto(`${url}?seed=7`);
  await page.waitForSelector('#source-language option[value="python"]', {
    state: 'attached',
  });
  await translatesBetweenVersions();
  await detectsAndTranslatesPartially();
  await changesTheLeftLanguage();
  await showsTheMetaLanguage();
  await writesCommentsInAnotherLanguage();
  await showsRandomExamples();
  if (screenshot) {
    await page.screenshot({ path: screenshot, fullPage: true });
  }
  await savesAStandard();
  await changesTheSettings();
  assert.deepEqual(errors, []);
  console.log(
    'The web demo translates between languages and versions, detects the source language, translates partially, applies rules, shows the meta language, examples, standards and settings'
  );
} finally {
  await browser.close();
}
