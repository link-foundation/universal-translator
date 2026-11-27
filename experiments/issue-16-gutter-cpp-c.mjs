// Revisit the issue screenshot with its C++ source and C target in WebKit.
import { join } from 'node:path';
import { webkit } from 'playwright-core';

const [
  captures,
  appUrl = 'http://127.0.0.1:5173/',
  monacoPath = '/src/monaco.js',
  targetMatch = 'int main(',
] = process.argv.slice(2);
if (!captures) {
  throw new Error('Pass an existing directory for the screenshots');
}
const browser = await webkit.launch({
  executablePath: process.env.WEBKIT_EXECUTABLE || undefined,
});
try {
  const page = await browser.newPage({
    viewport: { width: 1824, height: 1123 },
    deviceScaleFactor: 2,
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const url = new URL(appUrl);
  url.hash =
    'settings=(settings%20(version%201)%20(theme%20app)%20(scheme%20dark)%20(editor%20monaco))';
  await page.goto(url.href);
  await page.waitForSelector('#source-text .monaco-editor');
  await page.selectOption('#source-language', 'cpp');
  await page.selectOption('#target-language', 'c');
  await page.evaluate(async (modulePath) => {
    const { loadMonaco } = await import(modulePath);
    const monaco = await loadMonaco();
    const editor = monaco.editor
      .getEditors()
      .find((e) => !e.getOption(monaco.editor.EditorOption.readOnly));
    editor.setValue(
      'int main(int argc, char** argv)\n{\n    try{\n        int i=0;\n        throw 8;\n    }\n    catch(int e)\n    {\n        return e;\n    }\n    return 0;\n}'
    );
    editor.focus();
    editor.setPosition({ lineNumber: 12, column: 2 });
  }, monacoPath);
  await page.waitForFunction(
    (expected) =>
      globalThis.document
        .querySelector('#target-text')
        ?.dataset.value?.includes(expected),
    targetMatch
  );
  await page.addStyleTag({
    content: '#source-text { min-height: 640px !important; }',
  });
  await page.waitForFunction(
    () =>
      globalThis.document.querySelector('#source-text .monaco-editor')
        ?.clientHeight >= 630
  );

  const geometry = await page.evaluate(() => {
    const margin = globalThis.document.querySelector('#source-text .margin');
    const last = [...margin.querySelectorAll('.line-numbers')].find(
      (line) => line.textContent === '12'
    );
    return {
      gutter: margin.getBoundingClientRect().toJSON(),
      last: last.getBoundingClientRect().toJSON(),
    };
  });
  const x = geometry.gutter.left + geometry.gutter.width / 2;
  const last = geometry.last.bottom;
  const blank = Math.min(last + 220, 1050);
  const capture = async (name) => {
    await page.screenshot({
      path: join(captures, `gutter-cpp-c-webkit-${name}.png`),
    });
    const result = await page.evaluate(
      ({ x, blank }) => {
        const selection = globalThis.getSelection();
        const point = globalThis.document.elementFromPoint(x, blank);
        const gutter = globalThis.document.querySelector(
          '#source-text .margin'
        );
        return {
          selected: selection.toString(),
          belowLastLine: point?.className,
          colour: globalThis.getComputedStyle(gutter).backgroundColor,
          renderedHighlights: [...gutter.querySelectorAll('.map-gutter')].map(
            (element) => element.getBoundingClientRect().toJSON()
          ),
        };
      },
      { x, blank }
    );
    console.log(JSON.stringify({ name, ...result }));
  };
  console.log(
    JSON.stringify({
      browser: browser.version(),
      geometry,
      sample: { x, blank },
    })
  );
  await capture('initial');
  await page.mouse.click(x, blank);
  await capture('click');
  await page.mouse.move(x, last - 9);
  await page.mouse.down();
  await page.mouse.move(x, blank, { steps: 12 });
  await page.mouse.up();
  await capture('drag-from-last-line');
  await page.mouse.move(x, blank);
  await page.mouse.down();
  await page.mouse.move(x, last - 9, { steps: 12 });
  await page.mouse.up();
  await capture('drag-to-last-line');
  await page.keyboard.press('Control+a');
  await capture('select-all');
  console.log(JSON.stringify({ errors }));
} finally {
  await browser.close();
}
