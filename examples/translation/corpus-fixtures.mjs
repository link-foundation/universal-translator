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
    return { path, language, form, effect: decodeEffect(task, parameters) };
  });
}

export function verifyProgram(translator, source, fixture, rustBinary) {
  const { language, form, effect, path } = fixture;
  const document = translator.parse(source, language);
  assert.equal(translator.restore(document), source, path);
  assert.equal(document.interpretation?.form, form, path);
  assert.deepEqual(document.interpretation.effect, effect, path);
  if (rustBinary) {
    const rust = (args) =>
      execFileSync(rustBinary, args, { encoding: 'utf8', input: source });
    assert.equal(rust(['roundtrip', language]), source, path);
    const args = ['translate', language, 'meta', '--mode', 'same-effect'];
    const meta = translator.translate(source, language, 'meta', {
      mode: 'same-effect',
    });
    assert.equal(rust(args), meta, path);
  }
}
