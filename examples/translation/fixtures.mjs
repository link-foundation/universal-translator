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

export function nativeProgram(source, language, effect, entry = 'gcd') {
  if (effect.task !== 'gcd-function') {
    return source;
  }
  const calls = gcdCalls.map(([left, right]) => `${entry}(${left}, ${right})`);
  if (language === 'javascript') {
    return `${source}\n${calls.map((call) => `console.log(${call});`).join('\n')}\n`;
  }
  const body = calls.map((call) => `    println!("{}", ${call});`).join('\n');
  return `${source}\nfn main() {\n${body}\n}\n`;
}

export function expectedOutput(effect) {
  switch (effect.task) {
    case 'hello':
      return `${effect.message}\n`;
    case 'write-text':
      return effect.message;
    case 'gcd-function':
      return gcdCalls.map(([, , result]) => `${result}\n`).join('');
    case 'greatest-common-divisor': {
      let { left, right } = effect;
      while (right !== 0) {
        [left, right] = [right, left % right];
      }
      return `${left}\n`;
    }
    case 'fizz-buzz':
      return Array.from({ length: effect.limit }, (_, index) => {
        const number = index + 1;
        const fizz = number % 3 === 0 ? 'Fizz' : '';
        const buzz = number % 5 === 0 ? 'Buzz' : '';
        return `${fizz + buzz || number}\n`;
      }).join('');
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
