import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { URL } from 'node:url';
import {
  linkFields,
  namedLinks,
  parseLinks,
  references,
} from '../../js/src/translation/links.js';
import { expectedOutput, nativeProgram } from './fixtures.mjs';

export function readCorpusCoverage() {
  const snapshot = new URL(
    '../../docs/case-studies/issue-1/data/corpus-coverage.lino',
    import.meta.url
  );
  return linkFields(parseLinks(readFileSync(snapshot, 'utf8')));
}

function decodeEffect(task, parameters) {
  switch (task) {
    case 'hello':
      assert.ok(parameters.length === 1 || parameters[1] === 'write-text');
      return { task: parameters[1] ?? task, message: parameters[0] };
    case 'fizz-buzz':
      return { task: parameters[1] ?? task, limit: Number(parameters[0]) };
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

export function rosettaPrograms(rosetta, task) {
  const programs = rosetta.get(`${task}-source-files`) ?? [];
  return namedLinks(programs, 'program').map((program) => {
    const [path, language, form, ...parameters] = references(program);
    return {
      path,
      language,
      form,
      effect: decodeEffect(task, parameters),
      exactForm: true,
    };
  });
}

function executePinnedPrograms(programs, expected, path) {
  const workspace = mkdtempSync(join(tmpdir(), 'translator-rosetta-'));
  try {
    for (const [language, source] of programs) {
      const cwd = join(workspace, language);
      mkdirSync(cwd);
      const options = { cwd, encoding: 'utf8', timeout: 45000 };
      let output;
      if (language === 'javascript') {
        writeFileSync(join(cwd, 'fixture.cjs'), source);
        output = execFileSync(process.execPath, ['fixture.cjs'], options);
      } else {
        writeFileSync(join(cwd, 'fixture.rs'), source);
        execFileSync(
          'rustc',
          ['--edition=2021', 'fixture.rs', '-o', 'fixture'],
          options
        );
        output = execFileSync('./fixture', [], options);
      }
      assert.equal(output, expected, `${path} (${language} stdout)`);
    }
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
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
        assert.equal(reconstructed, source, path);
      }
      assert.equal(
        rust(['translate', 'meta', language, '--form', form], meta),
        reconstructed,
        path
      );
      if (native && exactForm) {
        executePinnedPrograms(
          [
            [
              language,
              nativeProgram(
                source,
                language,
                effect,
                document.interpretation.output
              ),
            ],
            [target, nativeProgram(translated, target, effect)],
          ],
          expectedOutput(effect),
          path
        );
        return true;
      }
    }
  }
  return false;
}
