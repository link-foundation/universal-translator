import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import {
  linkFields,
  namedLinks,
  parseLinks,
  references,
} from '../../js/src/translation/links.js';
import {
  expectedOutput,
  fixture as readFixture,
  nativeArguments,
  nativeProgram,
} from './fixtures.mjs';

const legacyRust = 'rustc-1.5.0-nightly';
const quickJs = 'quickjs';
const cscript = 'cscript';

export function readCorpusCoverage() {
  const snapshot = new URL(
    '../../docs/case-studies/issue-1/data/corpus-coverage.lino',
    import.meta.url
  );
  return linkFields(parseLinks(readFileSync(snapshot, 'utf8')));
}

function decodeEffect(task, parameters) {
  switch (task) {
    case 'empty-program':
      assert.deepEqual(parameters, ['0']);
      return { task, status: 0 };
    case 'hello':
      assert.ok(
        parameters.length === 1 ||
          [
            'browser-alert',
            'browser-write',
            'write-text',
            'write-crlf',
          ].includes(parameters[1])
      );
      return { task: parameters[1] ?? task, message: parameters[0] };
    case 'fizz-buzz': {
      const [limit, variant = task, separator] = parameters;
      return variant === 'fizz-buzz-joined'
        ? { task: variant, limit: Number(limit), separator: Number(separator) }
        : { task: variant, limit: Number(limit) };
    }
    case 'ackermann-function': {
      const [effect, left, right] =
        parameters.length === 2 ? [task, ...parameters] : parameters;
      return {
        task: effect,
        left: Number(left),
        right: Number(right),
      };
    }
    case 'greatest-common-divisor':
      if (parameters[0] === 'gcd-function') {
        return { task: 'gcd-function', max: Number(parameters[1]) };
      }
      return {
        task,
        left: Number(parameters[0]),
        right: Number(parameters[1]),
      };
    default:
      assert.fail(`Unsupported task ${task}`);
  }
}

export function rosettaTasks(rosetta, key = 'authored-tasks') {
  return namedLinks(rosetta.get(key), 'task').map((task) => {
    const [id, name, inventory, tree, languages, samples, effect = id] =
      references(task);
    return { id, name, inventory, tree, languages, samples, effect };
  });
}

export function rosettaPrograms(rosetta, task) {
  const programs = rosetta.get(`${task.id}-source-files`) ?? [];
  return namedLinks(programs, 'program').map((program) => {
    const [path, language, form, ...parameters] = references(program);
    return {
      path,
      language,
      form,
      effect: decodeEffect(task.effect, parameters),
      exactForm: true,
    };
  });
}

function prepareJavaScript(cwd, source, requires) {
  if (requires.includes(cscript)) {
    const filename = 'fixture.js';
    writeFileSync(join(cwd, filename), source);
    return [
      'bash',
      fileURLToPath(new URL('./verify-wscript.sh', import.meta.url)),
      resolve(process.env.ROSETTA_WINE),
      filename,
    ];
  }
  const filename = 'fixture.cjs';
  writeFileSync(join(cwd, filename), source);
  if (requires.includes(quickJs)) {
    return [
      resolve(process.env.ROSETTA_QUICKJS),
      '--script',
      '--memory-limit',
      '32M',
      '--stack-size',
      '256K',
      filename,
    ];
  }
  return [process.execPath, filename];
}

function executePinnedPrograms(programs, effect, path) {
  const workspace = mkdtempSync(join(tmpdir(), 'translator-rosetta-'));
  try {
    for (const [language, source, requires = []] of programs) {
      const cwd = join(workspace, language);
      mkdirSync(cwd);
      const options = { cwd, encoding: 'utf8', timeout: 45000 };
      let command;
      let args;
      if (language === 'javascript') {
        [command, ...args] = prepareJavaScript(cwd, source, requires);
      } else {
        writeFileSync(join(cwd, 'fixture.rs'), source);
        if (requires.includes('num')) {
          for (const file of ['Cargo.toml', 'Cargo.lock']) {
            writeFileSync(join(cwd, file), readFixture(`rosetta-num/${file}`));
          }
          command = 'cargo';
          args = ['run', '--locked', '--quiet'];
        } else if (requires.includes(legacyRust)) {
          const compiler = resolve(process.env.ROSETTA_LEGACY_RUSTC);
          execFileSync(compiler, ['fixture.rs', '-o', 'fixture'], {
            ...options,
            env: {
              ...process.env,
              LD_LIBRARY_PATH: resolve(compiler, '../../lib'),
              RUST_LOG: 'error',
            },
          });
          command = './fixture';
          args = [];
        } else {
          execFileSync(
            'rustc',
            ['--edition=2021', 'fixture.rs', '-o', 'fixture'],
            options
          );
          command = './fixture';
          args = [];
        }
      }
      const label = `${path} (${language})`;
      let stdout = '';
      for (const inputs of nativeArguments(effect)) {
        const result = spawnSync(command, [...args, ...inputs], options);
        if (result.error) {
          throw result.error;
        }
        assert.equal(
          result.status,
          effect.status ?? 0,
          `${label} ${result.signal ?? result.stderr}`
        );
        stdout += result.stdout;
        if (
          requires.includes(quickJs) ||
          requires.includes(cscript) ||
          ['empty-program', 'fizz-buzz-function', 'fizz-buzz-joined'].includes(
            effect.task
          )
        ) {
          assert.equal(result.stderr, '', `${label} stderr`);
        }
      }
      assert.equal(stdout, expectedOutput(effect), `${label} stdout`);
    }
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
}

async function verifyNativePrograms(
  source,
  translated,
  { language, effect, path },
  target,
  { requires, output }
) {
  if (['browser-alert', 'browser-write'].includes(effect.task)) {
    const { verifyBrowser } = await import('./verify-browser.mjs');
    const programs = { [language]: source, [target]: translated };
    await verifyBrowser(programs.javascript, programs.rust, effect);
    return true;
  }
  if (requires.includes(legacyRust) && !process.env.ROSETTA_LEGACY_RUSTC) {
    console.log(
      `Native verification pending for ${path}: provide ROSETTA_LEGACY_RUSTC with the pinned x86-64 Linux compiler.`
    );
    return false;
  }
  if (requires.includes(quickJs) && !process.env.ROSETTA_QUICKJS) {
    console.log(
      `Native verification pending for ${path}: set ROSETTA_QUICKJS to the QuickJS shell's executable path.`
    );
    return false;
  }
  if (requires.includes(cscript) && !process.env.ROSETTA_WINE) {
    console.log(
      `Native verification pending for ${path}: set ROSETTA_WINE to the Wine 64-bit loader's executable path.`
    );
    return false;
  }
  const original =
    effect.task === 'fizz-buzz-joined' && language === 'javascript'
      ? `const { runInNewContext } = require('node:vm');
const value = runInNewContext(${JSON.stringify(source)}, { console }, { timeout: 500 });
process.stdout.write(JSON.stringify(value));
`
      : nativeProgram(source, language, effect, output);
  executePinnedPrograms(
    [
      [language, original, requires],
      [target, nativeProgram(translated, target, effect)],
    ],
    effect,
    path
  );
  return true;
}

export function verifyProgram(
  translator,
  source,
  fixture,
  rustBinary,
  native = false
) {
  const { language, form, effect, path, exactForm } = fixture;
  const document = translator.parse(source, language);
  assert.equal(translator.restore(document), source, path);
  assert.equal(document.interpretation?.form, form, path);
  assert.deepEqual(document.interpretation.effect, effect, path);
  if (rustBinary) {
    const rust = (args, input) =>
      execFileSync(rustBinary, args, { encoding: 'utf8', input });
    assert.equal(rust(['roundtrip', language], source), source, path);
    const options = { mode: 'same-effect' };
    const args = ['translate', language, 'meta', '--mode', 'same-effect'];
    const meta = translator.translate(source, language, 'meta', options);
    assert.equal(rust(args, source), meta, path);
    if (language === 'javascript' || language === 'rust') {
      const target = language === 'javascript' ? 'rust' : 'javascript';
      const translated = translator.translate(meta, 'meta', target, options);
      assert.equal(rust(['translate', 'meta', target], meta), translated, path);
      assert.equal(rust(['translate', target, 'meta'], translated), meta, path);
      assert.equal(
        translator.translate(translated, target, 'meta', options),
        meta,
        path
      );
      const reconstructed = translator.translate(meta, 'meta', language, {
        ...options,
        form,
      });
      if (exactForm) {
        const comments = new Set(
          document.interpretation.comments.map(({ line }) => line)
        );
        const uncommented = source
          .split('\n')
          .filter((_, index) => !comments.has(index))
          .join('\n');
        assert.equal(reconstructed, uncommented, path);
      }
      assert.equal(
        rust(['translate', 'meta', language, '--form', form], meta),
        reconstructed,
        path
      );
      if (native && exactForm) {
        return verifyNativePrograms(
          source,
          translated,
          fixture,
          target,
          document.interpretation
        );
      }
    }
  }
  return false;
}
