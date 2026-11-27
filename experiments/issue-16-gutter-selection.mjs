import { webkit } from 'playwright-core';

// Finite native-selection probes for the Safari gutter screenshot in issue 16.
const browser = await webkit.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1824, height: 1123 },
  });
  page.setDefaultTimeout(15000);
  await page.goto(
    'http://localhost:5173/#settings=(settings%20(version%201)%20(theme%20app)%20(scheme%20dark)%20(editor%20monaco))'
  );
  await page.waitForSelector('#source-text .monaco-editor');
  await page.locator('#source-language').selectOption('cpp');
  await page.locator('#target-language').selectOption('python');
  await page.evaluate(async () => {
    const { loadMonaco } = await import('/src/monaco.js');
    const monaco = await loadMonaco();
    const editor = monaco.editor
      .getEditors()
      .find((e) => !e.getOption(monaco.editor.EditorOption.readOnly));
    editor.setValue(
      'int main(int argc, char** argv)\n{\n    try{\n        int i=0;\n        throw 8;\n    }\n    catch(int e)\n    {\n        return e;\n    }\n    return 0;\n}'
    );
    editor.focus();
    editor.setPosition({ lineNumber: 12, column: 2 });
    editor.getDomNode().parentElement.style.minHeight = '640px';
  });
  await page.waitForFunction(() =>
    globalThis.document
      .querySelector('#target-text')
      ?.dataset.value?.includes('raise')
  );
  for (const mode of [
    'margin',
    'last-number',
    'after-lines',
    'editor',
    'between-number-and-code',
  ]) {
    const selection = await page.evaluate((mode) => {
      const node = globalThis.document.querySelector(
        '#source-text .monaco-editor'
      );
      const margin = node.querySelector('.margin');
      const numbers = [...margin.querySelectorAll('.line-numbers')];
      const last = numbers.at(-1);
      const range = globalThis.document.createRange();
      if (mode === 'margin') {
        range.selectNode(margin);
      }
      if (mode === 'last-number') {
        range.setStart(last.firstChild, last.textContent.length);
        range.setEndAfter(margin);
      }
      if (mode === 'after-lines') {
        range.setStartAfter(last.parentElement);
        range.setEndAfter(margin);
      }
      if (mode === 'editor') {
        range.selectNodeContents(node);
      }
      if (mode === 'between-number-and-code') {
        const firstText = globalThis.document
          .createTreeWalker(
            node.querySelector('.view-line'),
            globalThis.NodeFilter.SHOW_TEXT
          )
          .nextNode();
        range.setStart(last.firstChild, last.textContent.length);
        range.setEnd(firstText, 0);
      }
      const selected = globalThis.getSelection();
      selected.removeAllRanges();
      selected.addRange(range);
      return {
        mode,
        text: selected.toString(),
        range: range.getBoundingClientRect().toJSON(),
        height: node.getBoundingClientRect().height,
      };
    }, mode);
    await page.screenshot({
      path: `docs/case-studies/issue-16/logs/gutter-selection-${mode}.png`,
      fullPage: true,
    });
    console.log(JSON.stringify(selection));
  }
} finally {
  await browser.close();
}
