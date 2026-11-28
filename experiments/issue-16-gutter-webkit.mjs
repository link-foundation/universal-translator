import { webkit } from 'playwright-core';

const [
  screenshot = 'docs/screenshots/issue-16/gutter-webkit-investigation.png',
] = process.argv.slice(2);
const browser = await webkit.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1824, height: 1123 },
  });
  page.setDefaultTimeout(15000);
  const probe = async (page) => {
    await page.goto(
      'http://localhost:5173/#settings=(settings%20(version%201)%20(theme%20app)%20(scheme%20dark)%20(editor%20monaco))',
      { waitUntil: 'domcontentloaded' }
    );
    await page.waitForSelector('#source-text .monaco-editor');
    await page.locator('#source-language').selectOption('cpp');
    await page.locator('#target-language').selectOption('c');
    await page.evaluate(async () => {
      const { loadMonaco } = await import('/src/monaco.js');
      const m = await loadMonaco();
      const editor = m.editor
        .getEditors()
        .find((e) => !e.getOption(m.editor.EditorOption.readOnly));
      editor.setValue(
        'int main(int argc, char** argv)\n{\n    try{\n        int i=0;\n        throw 8;\n    }\n    catch(int e)\n    {\n        return e;\n    }\n    return 0;\n}'
      );
    });
    await page.waitForFunction(
      () =>
        globalThis.document.querySelector('#target-text-error') ||
        globalThis.document
          .querySelector('#target-text')
          ?.dataset.value?.includes('untranslated')
    );
    await page.waitForFunction(
      () =>
        globalThis.document.querySelector('#target-text-error') ||
        globalThis.document
          .querySelector('#target-text .view-lines')
          ?.textContent?.includes('untranslated')
    );
    await page.evaluate(
      () =>
        new Promise((r) =>
          globalThis.requestAnimationFrame(() =>
            globalThis.requestAnimationFrame(r)
          )
        )
    );
    await page.screenshot({
      path: screenshot,
      fullPage: true,
      scale: 'css',
    });
    return await page.evaluate(async () => {
      const { loadMonaco } = await import('/src/monaco.js');
      const m = await loadMonaco();
      return m.editor.getEditors().map((e) => {
        const model = e.getModel();
        const node = e.getDomNode();
        const rect = node.getBoundingClientRect();
        const bottom =
          rect.top +
          e.getBottomForLineNumber(model.getLineCount()) -
          e.getScrollTop();
        return {
          value: model.getValue(),
          height: rect.height,
          bottom,
          classes: [
            ...globalThis.document.elementsFromPoint(
              rect.left + 10,
              bottom + 30
            ),
          ].map((element) => ({
            class: element.className,
            background: globalThis.getComputedStyle(element).backgroundColor,
            style: element.getAttribute('style'),
          })),
          children: [...node.querySelectorAll('.margin *')].map((element) => ({
            class: element.className,
            top: Math.round(element.getBoundingClientRect().top),
            height: Math.round(element.getBoundingClientRect().height),
            background: globalThis.getComputedStyle(element).backgroundColor,
          })),
        };
      });
    });
  };
  console.log(JSON.stringify(await probe(page), null, 2));
} finally {
  await browser.close();
}
