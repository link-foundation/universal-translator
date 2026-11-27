import { describe, expect, it } from 'test-anywhere';
import { readFileSync } from 'node:fs';

import { programFiles } from '../../examples/programs/verify-native.mjs';
import { createGrammarTranslator } from '../src/translator.js';
import { grammarLanguageIds } from '../src/formal/languages.js';
import { meaningDifference, rewrite } from '../src/meta/tree.js';
import { nameWords, spellName } from '../src/formal/names.js';
import { contextRules, understandingRules } from '../src/formal/rules.js';
import { lowerProgram } from '../src/formal/lowering.js';

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
    it(`hand-written ${program.file} preserves structure and native arithmetic contracts`, () => {
      let expected = translator.toMeta(
        read(source(program.task)),
        'javascript'
      );
      // The handwritten examples use native %, whose signed contract differs
      // from JavaScript. Their positive example inputs did not expose this.
      if (['python', 'ruby', 'perl'].includes(program.language)) {
        expected = rewrite(expected, (item) =>
          item.kind === 'Binary' && item.operator === 'remainder'
            ? { ...item, operator: 'modulo' }
            : item
        );
      }
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

  it('escapes backslashes before braces in Lean interpolated text', () => {
    const program = 'const name = "x";\nconsole.log(`a\\\\b {c} ${name}`);\n';
    expect(translator.translate(program, 'javascript', 'lean')).toContain(
      'IO.println s!"a\\\\b \\{c} {name}"'
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
    expect(calls).toEqual([
      'copyReassignedParameters',
      'expandArrayFills',
      'expandForEach',
      'spellNames',
      'spellCommonLibrary',
    ]);
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

describe('machine targets', () => {
  const lower = (code) =>
    lowerProgram(translator.toMeta(code, 'javascript')).main.code;

  it('adapts comments and spells names for assembly, CIL and JVM', () => {
    const gcd = read(source('greatest-common-divisor'));
    const nasm = translator.translate(gcd, 'javascript', 'nasm');
    expect(nasm).toContain(
      '; Greatest common divisor in x86-64 assembly (NASM)'
    );
    expect(nasm).toContain('call greatest_common_divisor');
    const cil = translator.translate(gcd, 'javascript', 'cil');
    expect(cil).toContain('call int64 Program::GreatestCommonDivisor');
    const jvm = translator.translate(gcd, 'javascript', 'jvm', {
      mode: 'same-effect',
    });
    expect(jvm).toContain('invokestatic Program/greatestCommonDivisor(JJ)J');
    expect(jvm).not.toContain('; Greatest');
  });

  it('short-circuits conditions with jumps', () => {
    expect(
      lower('let a = 1;\nif (a > 0 && !(a === 2)) {\n  console.log(a);\n}\n')
    ).toEqual([
      ['push', 1],
      ['store', 0],
      ['load', 0],
      ['push', 0],
      ['compare-jump', 'lessOrEqual', 'L1'],
      ['load', 0],
      ['push', 2],
      ['compare-jump', 'equal', 'L1'],
      ['load', 0],
      ['print-integer'],
      ['print-newline'],
      ['jump', 'L2'],
      ['label', 'L1'],
      ['label', 'L2'],
      ['return-nothing'],
    ]);
    const either = lower(
      'let a = 1;\nwhile (a < 0 || a === 1) {\n  a += 1;\n}\n'
    );
    expect(either.slice(2, 10)).toEqual([
      ['label', 'L1'],
      ['load', 0],
      ['push', 0],
      ['compare-jump', 'less', 'L3'],
      ['load', 0],
      ['push', 1],
      ['compare-jump', 'notEqual', 'L2'],
      ['label', 'L3'],
    ]);
  });

  it('refuses programs it cannot lower', () => {
    expect(() =>
      translator.translate('let name = "Ada";\n', 'javascript', 'nasm')
    ).toThrow('cannot lower');
  });
});

describe('grammar translator: library spellings and names', () => {
  it('reads integer division written by the JavaScript and PHP emitters', () => {
    expect(
      translator.translate(
        'console.log(Math.trunc(7 / 2));\n',
        'javascript',
        'python'
      )
    ).toContain('print(ut_integer_divide(7, 2))');
    expect(
      translator.translate('<?php\necho intdiv(7, 2);\n', 'php', 'lua')
    ).toContain('ut_integer_divide(7, 2)');
  });

  it('writes integer division in JavaScript, TypeScript and PHP', () => {
    const source = 'a = 7 // 2\nprint(a)\n';
    for (const [target, spelling] of [
      ['javascript', 'utIntegerFloorDivide(7, 2)'],
      ['typescript', 'utIntegerFloorDivide(7, 2)'],
      ['php', 'utIntegerFloorDivide(7, 2)'],
    ]) {
      expect(translator.translate(source, 'python', target)).toContain(
        spelling
      );
    }
  });

  it('treats names inherited by JavaScript objects as ordinary names', () => {
    expect(
      translator.translate('toString("hi {}", 1);\n', 'rust', 'python')
    ).toContain('toString("hi {}", 1)');
    expect(
      translator.translate('constructor;\n', 'javascript', 'python')
    ).toContain('constructor');
  });
});
