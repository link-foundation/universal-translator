import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { runBrowserWasm } from './browser-wasm.mjs';

const browserSumCases = [
  ['2', '2', '4'],
  ['-1000', '-1000', '-2000'],
  ['1000', '1000', '2000'],
  ['-1000', '1000', '0'],
  ['+17', '-9', '8'],
  [` ${'0'.repeat(40)}3 `, '2', '5'],
];

async function verifyObservation(browser, run, { task, message }, sumCase) {
  const page = await browser.newPage();
  const dialogs = [];
  const unexpected = [];
  try {
    page.on('pageerror', (error) => unexpected.push(error.message));
    page.on('console', (entry) => unexpected.push(entry.text()));
    page.on('dialog', async (dialog) => {
      const response = sumCase?.[dialogs.length];
      dialogs.push([dialog.type(), dialog.message()]);
      if (dialog.type() === 'prompt' && response !== undefined) {
        dialogs.at(-1).push(dialog.defaultValue());
        await dialog.accept(response);
      } else {
        await dialog.dismiss();
      }
    });
    await run(page);
    if (sumCase) {
      const [left, right, sum] = sumCase;
      assert.deepEqual(dialogs, [
        ['prompt', 'enter A number', ''],
        ['prompt', 'enter B number', ''],
      ]);
      assert.equal(
        await page.locator('#input').textContent(),
        `${left} ${right}`
      );
      assert.equal(await page.locator('#output').textContent(), sum);
    } else if (task === 'browser-alert') {
      assert.deepEqual(dialogs, [['alert', message]]);
    } else {
      assert.deepEqual(dialogs, []);
      assert.equal(await page.locator('body').innerHTML(), message);
    }
    assert.deepEqual(unexpected, []);
  } finally {
    await page.close();
  }
}

export async function verifyBrowser(javascript, rust, effect) {
  const workspace = mkdtempSync(join(tmpdir(), 'translator-browser-'));
  try {
    writeFileSync(join(workspace, 'browser.rs'), rust);
    execFileSync(
      'rustc',
      [
        '--edition=2021',
        '--target=wasm32-unknown-unknown',
        '--crate-type=cdylib',
        '-C',
        'opt-level=s',
        '-C',
        'strip=symbols',
        'browser.rs',
        '-o',
        'browser.wasm',
      ],
      { cwd: workspace, encoding: 'utf8', timeout: 45000 }
    );
    const bytes = [...readFileSync(join(workspace, 'browser.wasm'))];
    const browser = await chromium.launch({ channel: 'chrome' });
    try {
      if (effect.task === 'browser-integer-sum') {
        for (const sumCase of browserSumCases) {
          await verifyObservation(
            browser,
            (page) => page.setContent(javascript),
            effect,
            sumCase
          );
          await verifyObservation(
            browser,
            async (page) => {
              await page.setContent(
                '<div id="input"></div><div id="output"></div>'
              );
              await page.evaluate(runBrowserWasm, {
                bytes,
                entry: 'prompt_sum',
              });
            },
            effect,
            sumCase
          );
        }
        return;
      }
      const entry =
        effect.task === 'browser-alert' ? 'show_alert' : 'write_document';
      await verifyObservation(
        browser,
        (page) => page.addScriptTag({ content: javascript }),
        effect
      );
      await verifyObservation(
        browser,
        (page) => page.evaluate(runBrowserWasm, { bytes, entry }),
        effect
      );
    } finally {
      await browser.close();
    }
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
}
