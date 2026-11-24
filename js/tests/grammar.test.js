import { describe, expect, it } from 'test-anywhere';
import { readFileSync } from 'node:fs';

import { programFiles } from '../../examples/programs/verify-native.mjs';
import { createGrammarTranslator } from '../src/grammar/translator.js';
import { grammarLanguageIds } from '../src/grammar/languages.js';
import { meaningDifference, rewrite } from '../src/grammar/meta.js';
import { nameWords, spellName } from '../src/grammar/names.js';
import { contextRules, understandingRules } from '../src/grammar/rules.js';

const translator = createGrammarTranslator();
const programs = programFiles();
const source = (task) =>
  programs.find(
    (program) => program.task === task && program.language === 'javascript'
  );
const read = (program) => readFileSync(program.path, 'utf8');

const issueC = `// Hello World in C

#include <stdio.h>

int main() {
    // print "Hello World!" into console followed by new line symbol by function call
    printf("Hello World!\\n");
    return 0;
}
`;

describe('grammar translator: the issue example', () => {
  it('adapts comments to the target language by default', () => {
    const csharp = translator.translate(issueC, 'c', 'csharp');
    expect(csharp).toContain('Hello World in C#');
    expect(csharp).toContain('by method call');
    expect(csharp).toContain('System.Console.WriteLine("Hello World!");');
    expect(csharp).toContain('static void Main()');
  });

  it('keeps comments word for word in literal mode', () => {
    const csharp = translator.translate(issueC, 'c', 'csharp', {
      mode: 'literal',
    });
    expect(csharp).toContain('Hello World in C ');
    expect(csharp).toContain('by function call');
  });

  it('keeps only the behaviour in same-effect mode', () => {
    const csharp = translator.translate(issueC, 'c', 'csharp', {
      mode: 'same-effect',
    });
    expect(csharp).not.toContain('Hello World in');
    expect(csharp).toContain('System.Console.WriteLine("Hello World!");');
  });

  it('rejects unknown modes and languages', () => {
    expect(() =>
      translator.translate(issueC, 'c', 'csharp', { mode: 'loose' })
    ).toThrow('Unsupported mode');
    expect(() => translator.translate(issueC, 'c', 'cobol')).toThrow(
      'does not describe'
    );
  });
});

describe('grammar translator: meaning is preserved', () => {
  for (const program of programs.filter(
    ({ language }) => language === 'javascript'
  )) {
    it(`${program.file} returns to the same meta program from every language`, () => {
      const meta = translator.toMeta(read(program), 'javascript');
      for (const language of grammarLanguageIds) {
        const target = translator.fromMeta(meta, language, {
          from: 'javascript',
        });
        expect([
          language,
          meaningDifference(meta, translator.toMeta(target, language)),
        ]).toEqual([language, undefined]);
      }
    });
  }

  for (const program of programs.filter(
    ({ language }) => language !== 'javascript'
  )) {
    it(`hand-written ${program.file} means the same as the JavaScript program`, () => {
      const expected = translator.toMeta(
        read(source(program.task)),
        'javascript'
      );
      expect(
        meaningDifference(
          expected,
          translator.toMeta(read(program), program.language)
        )
      ).toBe(undefined);
    });
  }
});

describe('grammar translator: target conventions', () => {
  const gcd = read(source('greatest-common-divisor'));

  it('spells declared names in each language convention', () => {
    expect(translator.translate(gcd, 'javascript', 'python')).toContain(
      'def greatest_common_divisor(first, second):'
    );
    expect(translator.translate(gcd, 'javascript', 'csharp')).toContain(
      'static int GreatestCommonDivisor(int first, int second)'
    );
    expect(translator.translate(gcd, 'javascript', 'go')).toContain(
      'func greatestCommonDivisor(first int, second int) int {'
    );
    expect(nameWords('greatestCommonDivisor')).toEqual([
      'greatest',
      'common',
      'divisor',
    ]);
    expect(nameWords('HTTPServer_port')).toEqual(['http', 'server', 'port']);
    expect(spellName('greatest-common-divisor', 'pascal')).toBe(
      'GreatestCommonDivisor'
    );
  });

  it('copies reassigned parameters where parameters are immutable', () => {
    expect(translator.translate(gcd, 'javascript', 'rust')).toContain(
      'let mut first: i64 = first;'
    );
    expect(translator.translate(gcd, 'javascript', 'kotlin')).toContain(
      'var first = first'
    );
    expect(translator.translate(gcd, 'javascript', 'python')).not.toContain(
      'first = first'
    );
  });

  it('writes compound assignment only where the language has it', () => {
    const squares = read(source('sum-of-squares'));
    expect(translator.translate(squares, 'javascript', 'lua')).toContain(
      'total = total + number * number'
    );
    expect(translator.translate(squares, 'javascript', 'python')).toContain(
      'total += number * number'
    );
  });

  it('turns text concatenation into each language interpolation', () => {
    const factorial = read(source('factorial'));
    expect(translator.translate(factorial, 'javascript', 'python')).toContain(
      'print(f"{number}! = {factorial(number)}")'
    );
    expect(translator.translate(factorial, 'javascript', 'swift')).toContain(
      'print("\\(number)! = \\(factorial(number))")'
    );
    expect(translator.translate(factorial, 'javascript', 'c')).toContain(
      'printf("%d! = %d\\n", number, factorial(number));'
    );
  });
});

describe('grammar translator: replaceable rule layers', () => {
  const hello = read(source('hello-world'));

  it('applies custom meta to meta layers before the context rules', () => {
    const shout = (program) =>
      rewrite(program, (current) =>
        current.kind === 'Text'
          ? { ...current, value: current.value.toUpperCase() }
          : current
      );
    const custom = createGrammarTranslator({ layers: [[shout]] });
    expect(custom.translate(hello, 'javascript', 'python')).toContain(
      'print("HELLO WORLD!")'
    );
  });

  it('lets callers remove or decorate a rule', () => {
    const calls = [];
    const decorated = contextRules.map((rule) => (program, settings) => {
      calls.push(rule.name);
      return rule(program, settings);
    });
    const withoutComments = createGrammarTranslator({
      context: decorated.filter(
        (_, index) => contextRules[index].name !== 'adaptComments'
      ),
    });
    expect(withoutComments.translate(hello, 'javascript', 'ruby')).toContain(
      '# Hello World in JavaScript'
    );
    expect(calls).toEqual(['copyReassignedParameters', 'spellNames']);
    expect(understandingRules.map((rule) => rule.name)).toContain(
      'recognizePrint'
    );
  });

  it('reports every stage through the trace hook', () => {
    const stages = [];
    createGrammarTranslator({ trace: (stage) => stages.push(stage) }).translate(
      hello,
      'javascript',
      'go'
    );
    expect(stages).toEqual([
      'parsed',
      'understood',
      'typed',
      'transformed',
      'adapted',
    ]);
  });

  it('explains syntax errors with the line number', () => {
    expect(() => translator.toMeta('let = ;', 'javascript')).toThrow('line 1');
  });
});

describe('shared golden translations', () => {
  it('matches every file under examples/programs/translated', async () => {
    const { expectedTranslations } =
      await import('../../examples/programs/write-translations.mjs');
    for (const { path, text } of expectedTranslations()) {
      expect(readFileSync(path, 'utf8')).toBe(text);
    }
  });
});
