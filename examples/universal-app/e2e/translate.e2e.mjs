// End-to-end check of the web demo in a real browser: translations between
// languages and their versions, the left language changing with the text
// said in it, the meta language of both texts, random examples (program,
// function, statement), the comment language, the Standards tab (a
// vocabulary saved as a standard of one's own, words defined through other
// words), the settings panel (skin, scheme, interface language), the source
// language detected by default, untranslatable parts listed (or failing the
// whole text when all-or-nothing is on) and rules from the Rules tab
// applied, as rows or as Links Notation. Issue 12: panes of equal height
// that do not move the title and the pickers, word wrap, skins that change
// the look and the Monaco editor coloured from the meta language.
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

  // A rule from the Rules tab changes the translation, and the Translate
  // tab says that rules are in use.
  await page.click('#tab-rules');
  await page.click('#add-output');
  await page.fill('#rule-output-0-find', 'console.log');
  await page.fill('#rule-output-0-replace', 'print');
  if (screenshot) {
    await page.screenshot({
      path: screenshot.replace(/\.png$/u, '-rules.png'),
      fullPage: true,
    });
  }
  await page.click('#tab-translate');
  await page.waitForSelector('#target-text:has-text("print(x)")');
  assert.match(await page.locator('#rules-note').textContent(), /1/);
  await page.click('#tab-rules');
  await page.click('button[data-action="remove-rule"]');
  await page.click('#tab-translate');
  await page.waitForSelector('#target-text:has-text("console.log(x)")');
}

// The rules as text are indented Links Notation, saved as such; a text
// that is not rules says why and changes nothing.
async function editsRulesAsLinksNotation() {
  await page.click('#tab-rules');
  await page.fill('#rules-text', 'output\n  find print\n');
  await page.click('#apply-rules');
  assert.match(
    await page.locator('#rules-text-error').textContent(),
    /source:, templates:, names:, output:/
  );
  await page.fill(
    '#rules-text',
    'output:\n  (find console.log) (replace say)\n'
  );
  await page.click('#apply-rules');
  assert.equal(await page.locator('#rules-text-error').count(), 0);
  const saved = await page.evaluate(() =>
    globalThis.localStorage.getItem('rules')
  );
  assert.match(saved, /^output:\n/u, 'rules are kept as Links Notation');
  assert.doesNotMatch(saved, /^[[{]/u, 'not JSON');
  await page.click('#tab-translate');
  await translation('javascript', 'python', 'console.log("Hi");\n');
  await choose('target', 'javascript');
  await page.waitForSelector('#target-text:has-text("say(")');
  await page.click('#tab-rules');
  await page.fill('#rules-text', '');
  await page.click('#apply-rules');
  await page.click('#tab-translate');
  await page.waitForSelector('#target-text:has-text("console.log(")');
}

// The panes on both sides are as high as each other and grow with their
// text; the title and the pickers stay where they are meanwhile.
async function keepsTheLayoutStill() {
  // Where an element is on the page (not in the window, which scrolls).
  const box = (selector) =>
    page.$eval(selector, (element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y: y + globalThis.scrollY, width, height };
    });
  const title = await box('#translator-title');
  const picker = await box('#target-language');
  for (const text of ['x = 1\n', 'x = 1\n'.repeat(30)]) {
    await translation('python', 'javascript', text);
    const [source, target] = [
      await box('#source-text'),
      await box('#target-text'),
    ];
    assert.ok(
      Math.abs(source.height - target.height) < 1,
      `panes ${source.height} and ${target.height} differ`
    );
    assert.ok(source.height >= 250, 'a pane has room for a few lines');
    assert.ok(source.height <= 900 * 0.7 + 1, 'a pane stops growing');
    assert.deepEqual(await box('#translator-title'), title);
    assert.equal((await box('#target-language')).y, picker.y);
  }
}

// Word wrap is a check beside the options and a setting.
async function wrapsLongLines() {
  assert.equal(await page.getAttribute('html', 'data-wrap'), 'true');
  const long = `x = ${'1 + '.repeat(80)}1\n`;
  await translation('python', 'javascript', long);
  const wrapped = await page.locator('#target-text').boundingBox();
  await page.uncheck('#word-wrap');
  assert.equal(await page.getAttribute('html', 'data-wrap'), 'false');
  const unwrapped = await page.locator('#target-text').boundingBox();
  assert.ok(unwrapped.height <= wrapped.height, 'one line when not wrapped');
  assert.equal(
    await page.$eval(
      '#target-text',
      (pane) => globalThis.getComputedStyle(pane).whiteSpace
    ),
    'pre'
  );
  await page.check('#word-wrap');
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
  assert.match(source, /^ {4}text Hi \(type text\)$/m);
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

// How the translator panel looks: a skin changes it.
const look = () =>
  page.$eval('.translator-panel', (panel) => {
    const style = globalThis.getComputedStyle(panel);
    return {
      background: style.backgroundColor,
      radius: style.borderRadius,
      filter: style.backdropFilter,
    };
  });

async function changesTheSettings() {
  const app = await look();
  await page.click('#settings-link');
  const panel = page.locator('#settings-panel');
  await panel.waitFor();
  // The skin is the first choice: a listbox of @link-foundation/ui-components.
  await panel.locator('[role="combobox"]').first().click();
  await panel.locator('ui-option[data-value="glass"]').click();
  await page.waitForSelector('#ui-theme', { state: 'attached' });
  assert.equal(await page.getAttribute('html', 'data-theme'), 'glass');
  // The skin is seen, in the light and the dark scheme alike.
  await page.waitForFunction(
    (before) =>
      globalThis.getComputedStyle(
        globalThis.document.querySelector('.translator-panel')
      ).backgroundColor !== before,
    app.background
  );
  const glass = await look();
  assert.notDeepEqual(glass, app, 'the glass skin changes the panel');
  await page.emulateMedia({ colorScheme: 'dark' });
  assert.notDeepEqual(await look(), glass, 'the dark glass skin differs');
  assert.notEqual((await look()).radius, app.radius);
  await page.emulateMedia({ colorScheme: 'light' });
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

// The Monaco editor, chosen in the settings: both panes, coloured from the
// meta language with the colours of the skin, and the text still
// translates.
async function editsInMonaco() {
  await page.goto(
    `${url}#settings=(settings%20(version%201)%20(theme%20app)%20(editor%20monaco))`
  );
  await page.reload();
  await page.waitForSelector('#source-text .monaco-editor', {
    timeout: 60000,
  });
  await page.waitForSelector('#target-text .monaco-editor');
  await choose('source', 'python');
  await choose('target', 'javascript');
  await page.click('#source-text .view-lines');
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText('print(gcd(48, 18))');
  await page.waitForSelector(
    '#target-text[data-value*="console.log(gcd(48, 18))"]'
  );
  // gcd is a function and 48 a number: coloured, and not alike. Monaco
  // draws the lines a moment after the text is set.
  const colour = async (word) => {
    const span = await page.waitForFunction(
      (text) =>
        [
          ...globalThis.document.querySelectorAll(
            '#target-text .view-line > span > span'
          ),
        ].find((it) => it.textContent === text),
      word
    );
    return span.evaluate((it) => globalThis.getComputedStyle(it).color);
  };
  const [fn, number] = [await colour('gcd'), await colour('48')];
  assert.notEqual(fn, number);
  assert.notEqual(fn, 'rgb(0, 0, 0)');
  const [source, target] = [
    await page.locator('#source-text').boundingBox(),
    await page.locator('#target-text').boundingBox(),
  ];
  assert.ok(Math.abs(source.height - target.height) < 1, 'equal panes');
  if (screenshot) {
    await page.screenshot({
      path: screenshot.replace(/\.png$/u, '-monaco.png'),
      fullPage: true,
    });
  }
}

try {
  await page.goto(`${url}?seed=7`);
  await page.waitForSelector('#source-language option[value="python"]', {
    state: 'attached',
  });
  await translatesBetweenVersions();
  await detectsAndTranslatesPartially();
  await editsRulesAsLinksNotation();
  await keepsTheLayoutStill();
  await wrapsLongLines();
  await changesTheLeftLanguage();
  await showsTheMetaLanguage();
  await writesCommentsInAnotherLanguage();
  await showsRandomExamples();
  if (screenshot) {
    await page.screenshot({ path: screenshot, fullPage: true });
  }
  await savesAStandard();
  await changesTheSettings();
  await editsInMonaco();
  assert.deepEqual(errors, []);
  console.log(
    'The web demo translates between languages and versions, detects the source language, translates partially, applies rules (rows and Links Notation), keeps equal panes still, wraps lines, shows the meta language, examples, standards, settings with skins and the Monaco editor'
  );
} finally {
  await browser.close();
}
