import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'test-anywhere';

import { runCli } from '../../bin/universal-translator.js';
import { meaningDifference, sameMeaning } from '../src/meta/tree.js';
import {
  checkDescription,
  checkText,
  createTranslator,
  grammarLanguageIds,
  naturalLanguage,
  naturalLanguageIds,
  readNatural,
  semanticPrimes,
  writeNatural,
} from '../src/index.js';

const translator = createTranslator();
const { expectedNaturalTexts } =
  await import('../../examples/programs/write-natural.mjs');
const texts = expectedNaturalTexts();

// The 30 most spoken languages the issue asks for, each in a small
// controlled version, and the controlled language standards it names.
const languages = [
  'english',
  'chinese',
  'hindi',
  'spanish',
  'french',
  'arabic',
  'bengali',
  'portuguese',
  'russian',
  'urdu',
  'indonesian',
  'german',
  'japanese',
  'marathi',
  'telugu',
  'turkish',
  'tamil',
  'vietnamese',
  'korean',
  'italian',
  'persian',
  'swahili',
  'tagalog',
  'thai',
  'polish',
  'ukrainian',
  'hausa',
  'gujarati',
  'punjabi',
  'dutch',
];
const profiles = {
  'english-asd-ste100': 'ASD-STE100 Simplified Technical English',
  'english-ace': 'Attempto Controlled English',
  'english-gellish': 'Gellish Formal English',
  'dutch-gellish': 'Gellish Formeel Nederlands',
  'english-sbvr': 'SBVR Structured English',
  'english-plain-language': 'Plain language, ISO 24495-1',
  'minimal-english': 'Minimal English',
  'minimal-french': 'Minimal French',
  'minimal-polish': 'Minimal Polish',
  'english-e-prime': 'E-Prime',
  'english-basic-english': 'Basic English',
  'english-special-english': 'VOA Special English',
  'english-globish': 'Globish',
  'english-british': 'English (British)',
};

describe('controlled natural languages', () => {
  it('describes at least 30 natural languages and every named standard', () => {
    const ids = naturalLanguageIds();
    expect(languages.length).toBe(30);
    for (const id of [...languages, ...Object.keys(profiles)]) {
      expect(ids).toContain(id);
    }
    for (const [id, label] of Object.entries(profiles)) {
      expect(naturalLanguage(id).label).toContain(label);
    }
    expect(naturalLanguage('english').profile).toBe('cnl-default');
  });

  it('lists the 65 semantic primes with English exponents', () => {
    const primes = semanticPrimes();
    expect(primes.length).toBe(65);
    for (const { exponents } of primes) {
      expect(exponents.english?.length).toBeGreaterThan(0);
    }
  });

  it('keeps the rules of every language description', () => {
    for (const id of naturalLanguageIds()) {
      expect([id, ...checkDescription(id)]).toEqual([id]);
    }
  });
});

describe('every task in every natural language', () => {
  it('matches every file under examples/programs/natural', () => {
    const tasks = readdirSync('examples/programs').filter((file) =>
      file.endsWith('.js')
    );
    expect(texts.length).toBe(tasks.length * naturalLanguageIds().length);
    for (const { path, text } of texts) {
      expect(readFileSync(path, 'utf8')).toBe(text);
    }
  });

  it('reads every text back to the same meaning', () => {
    for (const { meta, text, language, task } of texts) {
      const back = readNatural(text, language);
      const same = sameMeaning(meta, back);
      expect([task, language, same || meaningDifference(meta, back)]).toEqual([
        task,
        language,
        true,
      ]);
    }
  });

  it('keeps the rules of the controlled language in every text', () => {
    for (const { text, language, task } of texts) {
      expect([task, language, ...checkText(text, language)]).toEqual([
        task,
        language,
      ]);
    }
  });

  it('translates every text to every programming language', () => {
    for (const { text, language, task, meta } of texts.filter(({ language }) =>
      ['russian', 'chinese', 'minimal-english'].includes(language)
    )) {
      for (const target of grammarLanguageIds) {
        const code = translator.translate(text, language, target);
        const direct = translator.fromMeta(meta, target);
        expect([
          task,
          target,
          sameMeaning(
            translator.toMeta(code, target),
            translator.toMeta(direct, target)
          ),
        ]).toEqual([task, target, true]);
      }
    }
  });

  it('translates programming languages to words through the translator', () => {
    const python = readFileSync(
      'examples/programs/translated/factorial/factorial.py',
      'utf8'
    );
    const words = translator.translate(python, 'python', 'spanish');
    expect(words).toContain('factorial');
    expect(
      sameMeaning(
        translator.toMeta(words, 'spanish'),
        translator.toMeta(python, 'python')
      )
    ).toBe(true);
  });
});

describe('rule checks catch violations', () => {
  it('limits sentence length (ASD-STE100)', () => {
    const long = `Write ${Array(25).fill('x').join(' plus ')}.`;
    expect(checkText(long, 'english-asd-ste100').join()).toContain('words');
  });

  it('forbids forms of "to be" (E-Prime)', () => {
    expect(
      checkText('If x is 0, do this:', 'english-e-prime').join()
    ).toContain('forbidden "is"');
  });

  it('forbids "shall" (plain language)', () => {
    expect(
      checkText('The total shall be 0.', 'english-plain-language').join()
    ).toContain('forbidden "shall"');
  });

  it('requires an allowed first word (Attempto Controlled English)', () => {
    expect(checkText('Perhaps write x.', 'english-ace').join()).toContain(
      'starts with "Perhaps"'
    );
  });

  it('requires the Gellish relation phrases', async () => {
    const { checkDescription: check } = await import('../src/natural/rules.js');
    const gellish = naturalLanguage('english-gellish');
    const saved = gellish.templates;
    gellish.templates = {
      ...saved,
      assign: ['{name} becomes {value}'],
      'set-element': ['item {index} of {name} becomes {value}'],
    };
    try {
      expect(check('english-gellish').join()).toContain(
        'relation "has as new value"'
      );
    } finally {
      gellish.templates = saved;
    }
  });

  it('rejects sentences outside the grammar', () => {
    expect(() => readNatural('Dance with the moon.', 'english')).toThrow();
  });
});

describe('command line', () => {
  const cli = (argv, input = '') => {
    const output = [];
    const errors = [];
    const status = runCli(argv, {
      read: () => input,
      write: (text) => output.push(text),
      stdout: (text) => output.push(text),
      stderr: (text) => errors.push(text),
    });
    return { status, output: output.join(''), errors: errors.join('\n') };
  };

  it('lists natural languages and translates words', () => {
    expect(cli(['languages']).output).toContain('russian\tRussian (natural)\n');
    const words = writeNatural(
      translator.toMeta('console.log("Hi");', 'javascript'),
      'english'
    );
    expect(cli(['translate', 'english', 'python'], words).output).toContain(
      'print("Hi")'
    );
    expect(cli(['check-words', 'english-e-prime'], 'X is 1.').status).toBe(1);
  });
});
