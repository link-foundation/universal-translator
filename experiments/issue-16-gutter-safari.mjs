// Drive Apple Safari itself through the WebDriver process started by macOS.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';

const [driverUrl, appUrl, captures, expected = 'int main(', allowSelection] =
  process.argv.slice(2);
assert.ok(
  driverUrl && appUrl && captures,
  'Pass driver URL, app URL and output directory'
);
const source = (
  await readFile(
    new URL('../examples/translation/exceptions.cpp', import.meta.url),
    'utf8'
  )
)
  .trimEnd()
  .replace('try {', 'try{')
  .replace('int i = 0;', 'int i=0;')
  .replace('catch (int e)', 'catch(int e)');

async function request(path, method = 'GET', payload) {
  const response = await fetch(new URL(path, driverUrl), {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const { value } = await response.json();
  if (!response.ok) {
    throw new Error(`${method} ${path}: ${value?.message ?? response.status}`);
  }
  return value;
}

async function waitFor(probe, description) {
  for (let attempt = 0; attempt < 120; attempt++) {
    if (await probe()) {
      return;
    }
    await pause(250);
  }
  throw new Error(`Waiting for ${description} exceeded 30 seconds`);
}

// These functions run in the browser through WebDriver's execute command.
async function prepareEditor(text) {
  const module = globalThis.performance
    .getEntriesByType('resource')
    .find(({ name }) => /\/monaco-[\w-]+\.js$/u.test(name));
  const { loadMonaco } = await import(module.name);
  const monaco = await loadMonaco();
  for (const [selector, value] of [
    ['#source-language', 'cpp'],
    ['#target-language', 'c'],
  ]) {
    const picker = globalThis.document.querySelector(selector);
    picker.value = value;
    picker.dispatchEvent(new globalThis.Event('change', { bubbles: true }));
  }
  const editor = monaco.editor
    .getEditors()
    .find(
      (instance) => !instance.getOption(monaco.editor.EditorOption.readOnly)
    );
  editor.setValue(text);
  editor.focus();
  editor.setPosition({ lineNumber: 12, column: 2 });
  const viewportStyle = globalThis.document.createElement('style');
  viewportStyle.textContent = '#source-text { min-height: 640px !important; }';
  globalThis.document.head.append(viewportStyle);
}

function scrollToGutter() {
  const pane = globalThis.document.querySelector('#source-text');
  pane.scrollIntoView({ block: 'start' });
  globalThis.scrollBy(0, -42);
}

function geometry() {
  const margin = globalThis.document.querySelector('#source-text .margin');
  const last = [...margin.querySelectorAll('.line-numbers')].find(
    (line) => line.textContent === '12'
  );
  const gutter = margin.getBoundingClientRect();
  const bottom = last.getBoundingClientRect().bottom;
  const x = Math.round(gutter.left + gutter.width / 2);
  const blank = Math.floor(
    Math.min(bottom + 220, gutter.bottom - 16, globalThis.innerHeight - 16)
  );
  const hit = globalThis.document.elementFromPoint(x, blank);
  return {
    x,
    bottom,
    blank,
    gutter: gutter.toJSON(),
    blankHitsMargin: margin.contains(hit),
    scrollY: globalThis.scrollY,
    scale: globalThis.devicePixelRatio,
    nativeSelection: globalThis.getSelection().toString().length,
    bars: [...margin.querySelectorAll('.map-gutter')].map((bar) =>
      bar.getBoundingClientRect().toJSON()
    ),
  };
}

const url = new URL(appUrl);
url.hash =
  'settings=(settings%20(version%201)%20(theme%20app)%20(scheme%20dark)%20(editor%20monaco))';
await mkdir(captures, { recursive: true });
await waitFor(
  () =>
    request('/status').then(
      ({ ready }) => ready,
      () => false
    ),
  'SafariDriver'
);
const { sessionId, capabilities } = await request('/session', 'POST', {
  capabilities: { alwaysMatch: { browserName: 'safari' } },
});
const session = (path, method, payload) =>
  request(`/session/${sessionId}${path}`, method, payload);
const evaluate = (callback, ...args) =>
  session('/execute/sync', 'POST', {
    script: `return (${callback})(...arguments);`,
    args,
  });
const move = (x, y) => ({
  type: 'pointerMove',
  duration: 90,
  x,
  y,
  origin: 'viewport',
});
const down = { type: 'pointerDown', button: 0 };
const up = { type: 'pointerUp', button: 0 };
const mouse = (actions) =>
  session('/actions', 'POST', {
    actions: [
      {
        type: 'pointer',
        id: 'mouse',
        parameters: { pointerType: 'mouse' },
        actions,
      },
    ],
  });

try {
  console.log(
    JSON.stringify({
      browser: capabilities.browserName,
      version: capabilities.browserVersion,
    })
  );
  await session('/url', 'POST', { url: url.href });
  await waitFor(
    () =>
      evaluate(() =>
        Boolean(
          globalThis.document.querySelector('#source-text .monaco-editor')
        )
      ),
    'the source editor'
  );
  const initialized = await session('/execute/async', 'POST', {
    script: `const [source, done] = arguments; (${prepareEditor})(source).then(() => done(null), error => done(String(error)));`,
    args: [source],
  });
  assert.equal(initialized, null);
  await waitFor(
    () =>
      evaluate(
        (match) =>
          globalThis.document
            .querySelector('#target-text')
            ?.dataset.value?.includes(match),
        expected
      ),
    'the C translation'
  );
  await evaluate(scrollToGutter);
  await waitFor(async () => {
    const position = await evaluate(geometry);
    return position.blankHitsMargin && position.blank > position.bottom + 24;
  }, 'the blank gutter inside the editor margin');
  const { bottom, blank, x } = await evaluate(geometry);
  const last = Math.floor(bottom - 9);
  const selections = [];
  for (const [name, actions] of [
    ['initial', []],
    ['click', [move(x, blank), down, up]],
    ['drag-from-last-line', [move(x, last), down, move(x, blank), up]],
    ['drag-to-last-line', [move(x, blank), down, move(x, last), up]],
  ]) {
    if (actions.length) {
      await mouse(actions);
    }
    const snapshot = await evaluate(geometry);
    const image = await session('/screenshot');
    await writeFile(
      join(captures, `${name}.png`),
      Buffer.from(image, 'base64')
    );
    console.log(JSON.stringify({ name, ...snapshot }));
    assert.ok(
      snapshot.bars.length,
      'The fixture must have visible mapping bars'
    );
    assert.ok(
      snapshot.bars.every((bar) => bar.bottom <= snapshot.bottom + 0.5)
    );
    assert.equal(
      snapshot.blankHitsMargin,
      true,
      'Pointer should hit the gutter'
    );
    if (snapshot.nativeSelection) {
      selections.push(name);
    }
  }
  const element = await session('/element', 'POST', {
    using: 'css selector',
    value: '#source-text .monaco-editor',
  });
  const elementId = element['element-6066-11e4-a52e-4f735466cecf'];
  const editorImage = await session(`/element/${elementId}/screenshot`);
  await writeFile(
    join(captures, 'editor.png'),
    Buffer.from(editorImage, 'base64')
  );
  if (allowSelection !== '--allow-native-selection') {
    assert.deepEqual(
      selections,
      [],
      'Gutter gestures started a page selection'
    );
  }
} finally {
  await session('', 'DELETE');
}
