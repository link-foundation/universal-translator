// Ranking of candidate translations by frequency and round trip, as truth
// values of relative meta logic, and the imprecision a meta program
// records. The Rust twin is rust/tests/ranking.rs.
import { describe, expect, it } from 'test-anywhere';

import { runCli } from '../../bin/universal-translator.js';
import {
  createTranslator,
  formatMeta,
  rankProse,
  readProse,
  translate,
  translateCandidates,
  translatePartial,
} from '../src/index.js';
import {
  priors,
  product,
  similarity,
  truth,
} from '../src/natural/probability.js';

function cli(argv, input = '') {
  const output = [];
  const status = runCli(argv, {
    read: () => input,
    write: (text) => output.push(text),
    stdout: (text) => output.push(text),
    stderr: () => {},
  });
  return { status, output: output.join('') };
}

const { toMeta } = createTranslator();

const greeting = 'Привет мир. Как дела?\n';

describe('probabilities', () => {
  it('keeps truth values on a grid of six decimals in [0, 1]', () => {
    expect(truth(1 / 3)).toBe(0.333333);
    expect(truth(2 / 3)).toBe(0.666667);
    expect(truth(1.5)).toBe(1);
    expect(truth(-1)).toBe(0);
    expect(truth(Number.NaN)).toBe(0.5);
  });

  it('combines independent values by their product', () => {
    expect(product([])).toBe(1);
    expect(product([0.5, 0.5])).toBe(0.25);
    expect(product([2 / 3, 2 / 3])).toBe(0.444445);
  });

  it('gives the most frequent reading the largest prior', () => {
    expect(priors(1)).toEqual([1]);
    expect(priors(2)).toEqual([0.666667, 0.333333]);
    expect(priors(3)).toEqual([0.545455, 0.272727, 0.181818]);
  });

  it('measures what survives a round trip in order', () => {
    expect(similarity([], [])).toBe(1);
    expect(similarity(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe(1);
    expect(similarity(['a', 'b', 'c', 'd'], ['a', 'x', 'c', 'd'])).toBe(0.75);
    expect(similarity(['a', 'b'], [])).toBe(0);
  });
});

describe('ranking', () => {
  it('ranks the readings of prose, the default first', () => {
    const ranked = rankProse('Привет мир. Как дела?', {
      from: 'russian',
      to: 'english',
    });
    expect(ranked[0]).toEqual({
      text: 'Hello world. How do?',
      probability: 0.296297,
      frequency: 0.296297,
      roundTrip: 1,
    });
    expect(ranked.map(({ text }) => text)).toContain('Hello peace. How do?');
    const probabilities = ranked.map(({ probability }) => probability);
    expect(probabilities).toEqual([...probabilities].sort((a, b) => b - a));
    expect(new Set(ranked.map(({ text }) => text)).size).toBe(ranked.length);
  });

  it('keeps prose in its own language as it is', () => {
    expect(
      rankProse('Hello world', { from: 'english', to: 'english' })
    ).toEqual([
      { text: 'Hello world', probability: 1, frequency: 1, roundTrip: 1 },
    ]);
  });

  it('makes the most probable candidate the default translation', () => {
    const candidates = translateCandidates(greeting, 'russian', 'english');
    expect(candidates[0].text).toBe(
      translatePartial(greeting, 'russian', 'english').text
    );
    expect(candidates[0].text).toBe('Hello world. How do?\n');
    expect(candidates.length).toBeGreaterThan(1);
    expect(candidates[0].coverage).toBe(1);
  });

  it('ranks the comments of a program', () => {
    const source = '# say hello to the world\nx = 1\nprint(x)\n';
    const options = { commentLanguage: 'russian' };
    const [best] = translateCandidates(source, 'python', 'python', options);
    expect(best.text).toBe(translate(source, 'python', 'python', options));
    expect(best.frequency).toBe(1);
    expect(best.roundTrip).toBeLessThan(1);
  });

  it('scores code without prose by its coverage', () => {
    expect(
      translateCandidates('x = 1\nprint(x)\n', 'python', 'javascript')
    ).toEqual([
      {
        text: 'const x = 1;\nconsole.log(x);\n',
        probability: 1,
        frequency: 1,
        roundTrip: 1,
        coverage: 1,
      },
    ]);
    const [partial] = translateCandidates(
      'x = 1\nfoo bar baz\n',
      'python',
      'javascript'
    );
    expect(partial.coverage).toBe(0.5);
    expect(partial.probability).toBe(0.5);
  });

  it('prints the candidates on the command line', () => {
    const { status, output } = cli(
      ['translate', 'russian', 'english', '-', '--candidates'],
      greeting
    );
    expect(status).toBe(0);
    expect(output.split('\n')[0]).toBe("(text 'Hello world. How do?");
    expect(output).toContain(
      "') (probability 0.296297) (frequency 0.296297) (roundTrip 1) (coverage 1)\n"
    );
    expect(output).toContain("(text 'Hello peace. How do?");
  });
});

describe('imprecision', () => {
  it('marks the ambiguous and the untranslated words of prose', () => {
    const [how, is, x] = readProse('how is x?').sentences[0].words;
    expect(how).toEqual({
      kind: 'Word',
      text: 'how',
      concept: 'how',
      part: 'interrogative',
      imprecision: 'ambiguous',
      alternatives: 2,
      probability: 0.666667,
    });
    expect(is.alternatives).toBe(3);
    expect(is.probability).toBe(0.545455);
    expect(x).toEqual({ kind: 'Word', text: 'x', imprecision: 'untranslated' });
  });

  it('marks numbers an integer type loses', () => {
    const source = 'x = 12345678901234567890\ny = 1.5\nz = 3\nprint(x)\n';
    const text = formatMeta(toMeta(source, 'python'));
    expect(text).toContain(
      'number 12345678901234567000 (imprecision rounded) (type integer)'
    );
    expect(text).toContain('number 1.5 (imprecision truncated) (type integer)');
    expect(text).toContain('number 3 (type integer)\n');
  });

  it('shows imprecision in the meta program and not in a translation', () => {
    const source = '// how is x?\nlet x = 1.5;\nconsole.log(x);\n';
    const { output } = cli(['meta', 'javascript', '-'], source);
    expect(output).toContain(
      'word how (alternatives 2) (concept how) (imprecision ambiguous) (part interrogative) (probability 0.666667)'
    );
    expect(output).toContain('word x (imprecision untranslated)');
    const json = JSON.parse(
      cli(['meta', 'javascript', '-', '--json'], source).output
    );
    expect(JSON.stringify(json)).toContain('"imprecision":"truncated"');
    const python = translate(source, 'javascript', 'python');
    expect(python).not.toContain('imprecision');
    expect(python).toContain('x = 1.5');
  });
});
