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

export function nativeArguments(effect) {
  return effect?.task === 'ackermann-cli'
    ? ackermannCalls.map(([left, right]) => [String(left), String(right)])
    : [[]];
}

export function nativeProgram(source, language, effect, entry) {
  if (effect.task === 'fizz-buzz-function') {
    if (language === 'javascript') {
      return `${source}\nprocess.stdout.write('call\\n');\nif (${entry ?? 'fizzBuzz'}() !== undefined) throw new Error('Unexpected return value');\n`;
    }
    return `${source}\nfn main() {\n    println!("call");\n    let () = ${entry ?? 'fizz_buzz'}();\n}\n`;
  }
  if (effect.task === 'fizz-buzz-joined') {
    return language === 'javascript'
      ? `${source}\nprocess.stdout.write(JSON.stringify(fizzBuzz()));\n`
      : `${source}\nfn main() {\n    print!("{:?}", fizz_buzz());\n}\n`;
  }
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

function expectedFizzBuzz({ task, limit, separator }) {
  const lowercase =
    task === 'fizz-buzz-lowercase' || task === 'fizz-buzz-lowercase-blank-line';
  const labels = Array.from({ length: limit }, (_, index) => {
    const number = index + 1;
    const fizz = number % 3 === 0 ? (lowercase ? 'fizz' : 'Fizz') : '';
    const buzz = number % 5 === 0 ? (lowercase ? 'buzz' : 'Buzz') : '';
    return fizz + buzz || String(number);
  });
  if (task === 'fizz-buzz-joined') {
    return JSON.stringify(labels.join(String.fromCharCode(separator)));
  }
  const lines = labels
    .map((label) =>
      task === 'fizz-buzz-quoted' ? `"${label}"\n` : `${label}\n`
    )
    .join('');
  if (task === 'fizz-buzz-function') {
    return `call\n${lines}`;
  }
  return task === 'fizz-buzz-lowercase-blank-line' ? `${lines}\n` : lines;
}

const fizzBuzzTasks = new Set([
  'fizz-buzz',
  'fizz-buzz-function',
  'fizz-buzz-lowercase',
  'fizz-buzz-quoted',
  'fizz-buzz-lowercase-blank-line',
  'fizz-buzz-joined',
]);

export function expectedOutput(effect) {
  if (fizzBuzzTasks.has(effect.task)) {
    return expectedFizzBuzz(effect);
  }
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
    case 'ackermann-cli':
      return ackermannCalls.map(([, , result]) => `${result}\n`).join('');
    case 'ackermann-json': {
      const results = ackermannCalls
        .filter(
          ([left, right]) => left <= effect.left && right === effect.right
        )
        .map(([, , result]) => result);
      return `${JSON.stringify(results)}\n`;
    }
    case 'ackermann-value': {
      const [, , result] = ackermannCalls.find(
        ([left, right]) => left === effect.left && right === effect.right
      );
      return `${result}\n`;
    }
    case 'greatest-common-divisor': {
      let { left, right } = effect;
      while (right !== 0) {
        [left, right] = [right, left % right];
      }
      return `${left}\n`;
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
