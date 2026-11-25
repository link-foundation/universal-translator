import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, it } from 'test-anywhere';
import { itUnless, sandboxed } from './helpers/skip.js';

const report = (results = []) => ({
  version: '2.1.0',
  runs: [
    {
      tool: { driver: { name: 'CodeQL' } },
      invocations: [{ executionSuccessful: true }],
      results,
    },
  ],
});
function check(reports) {
  const root = mkdtempSync(join(tmpdir(), 'sarif-gate-'));
  try {
    for (const [index, data] of reports.entries()) {
      writeFileSync(
        join(root, `${index}.sarif`),
        typeof data === 'string' ? data : JSON.stringify(data)
      );
    }
    return spawnSync(
      'node',
      [resolve('scripts/check-codeql-results.mjs'), root],
      { encoding: 'utf8' }
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
describe('CodeQL local result gate', () => {
  itUnless(sandboxed)(
    'accepts explicit clean reports from every language',
    () => {
      const result = check([report(), report()]);
      assert.equal(result.status, 0, result.stdout + result.stderr);
    }
  );
  for (const data of [
    [],
    ['{'],
    [{}],
    [{ version: '2.1.0', runs: [] }],
    [{ version: '2.1.0', runs: [{}] }],
    [
      {
        version: '2.1.0',
        runs: [
          {
            ...report().runs[0],
            invocations: [{ executionSuccessful: false }],
          },
        ],
      },
    ],
  ]) {
    itUnless(sandboxed)(
      `rejects missing, malformed, or unsuccessful evidence ${JSON.stringify(data)}`,
      () => {
        assert.notEqual(check(data).status, 0);
      }
    );
  }
  for (const level of ['error', 'warning', 'note', 'none', undefined]) {
    itUnless(sandboxed)(
      `rejects a finding with severity ${level} in a later run/file`,
      () => {
        const data = report();
        data.runs.push(
          report([
            {
              ruleId: 'test/finding',
              level,
              message: { text: 'regression finding' },
            },
          ]).runs[0]
        );
        const result = check([report(), data]);
        assert.notEqual(result.status, 0);
        assert.match(result.stdout + result.stderr, /test\/finding/);
      }
    );
  }
  it('makes full analysis and the strict result gate prerequisites of terminal success', () => {
    const workflow = readFileSync('.github/workflows/security.yml', 'utf8');
    assert.match(workflow, /CODEQL_ACTION_DIFF_INFORMED_QUERIES: 'false'/);
    assert.match(workflow, /output: codeql-results/);
    assert.ok(
      workflow.indexOf('scripts/check-codeql-results.mjs') >
        workflow.indexOf('github/codeql-action/analyze@v4')
    );
    assert.match(workflow, /path: codeql-results/);
  });
});

describe('CodeQL extraction diagnostics', () => {
  for (const key of [
    'toolExecutionNotifications',
    'toolConfigurationNotifications',
  ]) {
    for (const level of ['error', 'warning', undefined, 'note', 'none']) {
      itUnless(sandboxed)(
        `${key} enforces ${level ?? 'default warning'} even without findings`,
        () => {
          const data = report();
          data.runs[0].invocations[0][key] = [
            {
              level,
              descriptor: { id: 'extractor/failure' },
              message: { text: 'Extraction diagnostic' },
              locations: [
                {
                  physicalLocation: {
                    artifactLocation: { uri: 'src/example.js' },
                    region: { startLine: 42 },
                  },
                },
              ],
            },
          ];
          const result = check([data]);
          assert.equal(
            result.status,
            ['note', 'none'].includes(level) ? 0 : 1,
            result.stderr
          );
          if (result.status) {
            for (const text of [
              'extractor/failure',
              'src/example.js:42',
              'Extraction diagnostic',
            ]) {
              assert.ok(result.stderr.includes(text), result.stderr);
            }
          }
        }
      );
    }
    itUnless(sandboxed)(
      `${key} accepts CodeQL's empty success diagnostic`,
      () => {
        const data = report();
        data.runs[0].invocations[0][key] = [
          {
            level: 'none',
            descriptor: { id: 'js/diagnostics/successfully-extracted-files' },
            message: { text: '' },
            locations: [
              {
                physicalLocation: { artifactLocation: { uri: 'src/index.js' } },
              },
            ],
          },
        ];
        const result = check([data]);
        assert.equal(result.status, 0, result.stderr);
      }
    );
    for (const value of [
      null,
      {},
      'broken',
      [null],
      [{}],
      [{ level: 'invalid', message: { text: 'bad' } }],
      [{ level: 'none' }],
    ]) {
      itUnless(sandboxed)(
        `${key} rejects malformed evidence ${JSON.stringify(value)}`,
        () => {
          const data = report();
          data.runs[0].invocations[0][key] = value;
          assert.notEqual(check([data]).status, 0);
        }
      );
    }
  }
});

for (const field of ['message', 'ruleId', 'level', 'diagnostic']) {
  itUnless(sandboxed)(`quotes workflow commands from SARIF ${field}`, () => {
    const injected =
      'x\n::error title=spoof::forged\r::add-mask::secret\n::stop-commands::token ##[error]legacy';
    const data = report([
      {
        ruleId: field === 'ruleId' ? injected : 'rule',
        level: field === 'level' ? injected : 'error',
        message: { text: field === 'message' ? injected : 'finding' },
      },
    ]);
    if (field === 'diagnostic') {
      data.runs[0].invocations[0].toolExecutionNotifications = [
        {
          level: 'warning',
          descriptor: { id: injected },
          message: { text: injected },
          locations: [
            { physicalLocation: { artifactLocation: { uri: injected } } },
          ],
        },
      ];
    }
    const result = check([data]);
    assert.equal(result.status, 1);
    assert.doesNotMatch(
      result.stderr,
      /::(?:error|add-mask|stop-commands)|##\[error\]/
    );
    assert.match(result.stderr, /spoof/);
  });
}

describe('CodeQL accepted findings', () => {
  const alert =
    'https://github.com/link-foundation/universal-translator/security/code-scanning/5';
  const entry = {
    ruleId: 'js/regex-injection',
    path: 'js/src/translation/custom-rules.js',
    primaryLocationLineHash: 'abc:1',
    alert,
    reason: 'reviewed and dismissed',
  };
  const finding = (
    path = entry.path,
    hash = entry.primaryLocationLineHash
  ) => ({
    ruleId: entry.ruleId,
    message: { text: 'regular expression from a command-line argument' },
    locations: [{ physicalLocation: { artifactLocation: { uri: path } } }],
    partialFingerprints: { primaryLocationLineHash: hash },
  });
  const withRule = (results) => {
    const data = report(results);
    data.runs[0].tool.extensions = [
      { name: 'codeql/javascript-queries', rules: [{ id: entry.ruleId }] },
    ];
    return data;
  };
  async function run(reports, accepted) {
    const { checkCodeqlResults } =
      await import('../../scripts/check-codeql-results.mjs');
    const root = mkdtempSync(join(tmpdir(), 'sarif-accepted-'));
    const errors = [];
    const notices = [];
    try {
      for (const [index, data] of reports.entries()) {
        writeFileSync(join(root, `${index}.sarif`), JSON.stringify(data));
      }
      const acceptedFile = join(root, 'accepted.json');
      writeFileSync(acceptedFile, JSON.stringify(accepted));
      try {
        checkCodeqlResults(
          root,
          (line) => errors.push(line),
          acceptedFile,
          (line) => notices.push(line)
        );
        return { ok: true, errors, notices };
      } catch (error) {
        return { ok: false, errors, notices, message: error.message };
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }

  it('passes a reviewed finding and names its dismissed alert', async () => {
    const result = await run([withRule([finding()])], [entry]);
    assert.equal(result.ok, true, result.errors.join('\n'));
    assert.equal(result.notices.length, 1);
    assert.match(
      result.notices[0],
      /^::notice title=Accepted CodeQL finding::/
    );
    // An exact comparison: CodeQL reads includes() on a URL as an
    // incomplete URL sanitizer (js/incomplete-url-substring-sanitization).
    assert.equal(result.notices[0].match(/ \((\S+)\): /)?.[1], alert);
  });

  it('names the file, line and hash of a rejected finding', async () => {
    const other = finding('js/src/other.js');
    other.locations[0].physicalLocation.region = { startLine: 7 };
    const result = await run([withRule([other])], [entry]);
    assert.equal(result.ok, false);
    assert.match(
      result.errors.join('\n'),
      /at js\/src\/other\.js:7 \(primaryLocationLineHash [^)]+\): /
    );
  });

  it('still fails other findings of the same rule', async () => {
    for (const other of [
      finding('js/src/other.js'),
      finding(entry.path, 'changed-line:1'),
    ]) {
      const result = await run([withRule([finding(), other])], [entry]);
      assert.equal(result.ok, false);
      assert.equal(result.errors.length, 1, result.errors.join('\n'));
    }
  });

  it('fails a stale entry once the rule stops reporting it', async () => {
    const result = await run([withRule([])], [entry]);
    assert.equal(result.ok, false);
    assert.match(result.errors[0], /stale accepted finding/);
  });

  it('ignores the entry in reports that did not run the rule', async () => {
    const result = await run([report()], [entry]);
    assert.equal(result.ok, true, result.errors.join('\n'));
  });

  for (const accepted of [
    {},
    [{ ...entry, reason: ' ' }],
    [{ ...entry, alert: 'https://example.com/alert' }],
    [{ ...entry, primaryLocationLineHash: undefined }],
    [entry, entry],
  ]) {
    it(`rejects an unreviewable accepted list ${JSON.stringify(accepted)}`, async () => {
      const result = await run([withRule([finding()])], accepted);
      assert.equal(result.ok, false);
      assert.match(result.message, /accepted\.json|accepted findings/);
    });
  }

  it('keeps every committed entry tied to a dismissed alert', () => {
    const committed = JSON.parse(
      readFileSync('.github/codeql/accepted-findings.json', 'utf8')
    );
    assert.ok(Array.isArray(committed));
    for (const item of committed) {
      assert.match(
        item.alert,
        /^https:\/\/github\.com\/link-foundation\/universal-translator\/security\/code-scanning\/\d+$/
      );
      assert.ok(item.reason.length > 20);
    }
  });
});
