import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { readEffects } from '../../js/src/index.js';
import {
  linkFields,
  namedLinks,
  parseLinks,
  reference,
  references,
} from '../../js/src/translation/links.js';

export function fixture(name) {
  return readFileSync(new URL(name, import.meta.url), 'utf8');
}

export function exampleEffects() {
  return readEffects(fixture('effects.lino'));
}

// Include zero, negative operands, both bound endpoints, and a long
// Euclidean remainder chain. Supply the expected results independently.
const gcdCalls = [
  [0, 0, 0],
  [0, -3999, 3999],
  [-3999, 0, 3999],
  [399, -3999, 3],
  [-1071, -462, 21],
  [462, 1071, 21],
  [1134903170, 1836311903, 1],
  [2147483647, -2147483647, 2147483647],
];

// All 20 inputs in the bounded Ackermann function contract.
const ackermannCalls = [
  [1, 2, 3, 4, 5],
  [2, 3, 4, 5, 6],
  [3, 5, 7, 9, 11],
  [5, 13, 29, 61, 125],
].flatMap((row, left) => row.map((result, right) => [left, right, result]));

const callableEffects = new Map([
  ['gcd-function', { entry: 'gcd', cases: gcdCalls }],
  ['ackermann-function', { entry: 'ackermann', cases: ackermannCalls }],
]);

export function nativeProgram(source, language, effect, entry) {
  const callable = callableEffects.get(effect.task);
  if (!callable) {
    return source;
  }
  const name = entry ?? callable.entry;
  const calls = callable.cases.map(
    ([left, right]) => `${name}(${left}, ${right})`
  );
  if (language === 'javascript') {
    return `${source}\n${calls.map((call) => `console.log(${call});`).join('\n')}\n`;
  }
  const body = calls.map((call) => `    println!("{}", ${call});`).join('\n');
  return `${source}\nfn main() {\n${body}\n}\n`;
}

export function expectedOutput(effect) {
  switch (effect.task) {
    case 'empty-program':
      return '';
    case 'hello':
      return `${effect.message}\n`;
    case 'write-text':
      return effect.message;
    case 'gcd-function':
    case 'ackermann-function':
      return callableEffects
        .get(effect.task)
        .cases.map(([, , result]) => `${result}\n`)
        .join('');
    case 'greatest-common-divisor': {
      let { left, right } = effect;
      while (right !== 0) {
        [left, right] = [right, left % right];
      }
      return `${left}\n`;
    }
    case 'fizz-buzz':
    case 'fizz-buzz-lowercase':
    case 'fizz-buzz-quoted':
    case 'fizz-buzz-lowercase-blank-line': {
      const lowercase =
        effect.task === 'fizz-buzz-lowercase' ||
        effect.task === 'fizz-buzz-lowercase-blank-line';
      const lines = Array.from({ length: effect.limit }, (_, index) => {
        const number = index + 1;
        const fizz = number % 3 === 0 ? (lowercase ? 'fizz' : 'Fizz') : '';
        const buzz = number % 5 === 0 ? (lowercase ? 'buzz' : 'Buzz') : '';
        const line = fizz + buzz || number;
        return effect.task === 'fizz-buzz-quoted' ? `"${line}"\n` : `${line}\n`;
      }).join('');
      return effect.task === 'fizz-buzz-lowercase-blank-line'
        ? `${lines}\n`
        : lines;
    }
    default:
      throw new Error(`No stdout expectation for ${effect.task}`);
  }
}

export function localizedGreetings() {
  return readEffects(fixture('localized-greetings.lino'));
}

function observation(values) {
  if (values === undefined) {
    return undefined;
  }
  const fields = linkFields(values);
  return {
    count: Number(reference(fields.get('count'))),
    total: Number(reference(fields.get('total'))),
  };
}

export function referentInput() {
  const [link] = namedLinks(
    parseLinks(fixture('referent-input.lino')),
    'referents'
  );
  const fields = linkFields(link);
  return {
    source: reference(fields.get('source')),
    candidates: namedLinks(fields.get('candidates'), 'candidate').map(
      (values) => {
        const candidate = linkFields(values);
        return {
          id: reference(candidate.get('id')),
          target: reference(candidate.get('target')),
          type: references(candidate.get('type')),
          back: references(candidate.get('back')),
          sourceEvidence: observation(candidate.get('sourceEvidence')),
          targetEvidence: observation(candidate.get('targetEvidence')),
          context: candidate.has('context')
            ? Number(reference(candidate.get('context')))
            : undefined,
        };
      }
    ),
  };
}
