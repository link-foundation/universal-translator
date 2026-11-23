import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import {
  linkFields,
  namedLinks,
  parseLinks,
  references,
} from '../../js/src/translation/links.js';

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
      return { task, message: parameters[0] };
    case 'fizz-buzz':
      return { task, limit: Number(parameters[0]) };
    case 'greatest-common-divisor':
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

export function verifyProgram(translator, source, fixture, rustBinary) {
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
    }
  }
}
