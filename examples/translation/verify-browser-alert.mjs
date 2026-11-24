import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { showWasmAlert } from './browser-alert-wasm.mjs';

async function observeDialog(browser, run, message) {
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
    assert.deepEqual(dialogs, [['alert', message]]);
    assert.deepEqual(unexpected, []);
  } finally {
    await page.close();
  }
}

export async function verifyBrowserAlert(javascript, rust, message) {
  const workspace = mkdtempSync(join(tmpdir(), 'translator-browser-'));
  try {
    writeFileSync(join(workspace, 'alert.rs'), rust);
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
        'alert.rs',
        '-o',
        'alert.wasm',
      ],
      { cwd: workspace, encoding: 'utf8' }
    );
    const bytes = [...readFileSync(join(workspace, 'alert.wasm'))];
    const browser = await chromium.launch({ channel: 'chrome' });
    try {
      await observeDialog(
        browser,
        (page) => page.addScriptTag({ content: javascript }),
        message
      );
      await observeDialog(
        browser,
        (page) => page.evaluate(showWasmAlert, bytes),
        message
      );
    } finally {
      await browser.close();
    }
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
}
