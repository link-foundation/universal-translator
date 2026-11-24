import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { runBrowserWasm } from './browser-wasm.mjs';

async function verifyObservation(browser, run, { task, message }) {
  const page = await browser.newPage();
  const dialogs = [];
  const unexpected = [];
  try {
    page.on('pageerror', (error) => unexpected.push(error.message));
    page.on('console', (entry) => unexpected.push(entry.text()));
    page.on('dialog', async (dialog) => {
      dialogs.push([dialog.type(), dialog.message()]);
      await dialog.dismiss();
    });
    await run(page);
    if (task === 'browser-alert') {
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
    const entry =
      effect.task === 'browser-alert' ? 'show_alert' : 'write_document';
    const browser = await chromium.launch({ channel: 'chrome' });
    try {
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
