import { describe, expect, it } from 'test-anywhere';

import {
  exampleEffects,
  fixture,
  localizedGreetings,
  referentInput,
} from '../../examples/translation/fixtures.mjs';
import { runCli } from '../../bin/universal-translator.js';
import {
  createTranslator,
  languageProfiles,
  rankInterpretations,
  readEffects,
  translate,
  writeEffect,
} from '../src/index.js';

const effects = exampleEffects();
const hello = effects[0];
const translator = createTranslator();
const cSource = fixture('hello.c').replaceAll('\r\n', '\n');
const csharpSource = fixture('hello.cs').replaceAll('\r\n', '\n');
const expectedProfiles = {
  hello: 76,
  'greatest-common-divisor': 72,
  'fizz-buzz': 72,
  'write-text': 23,
  'gcd-function': 23,
  'fizz-buzz-lowercase': 23,
  'fizz-buzz-quoted': 23,
  'fizz-buzz-lowercase-blank-line': 23,
};

describe('translation through meta-language', () => {
  it('preserves a Rust greeting without a trailing newline in JavaScript and back', () => {
    const source = 'fn main() {\n   print!("Hello world!");\n}\n';
    const intermediate = translator.translate(source, 'rust', 'meta');
    expect(readEffects(intermediate)).toEqual([
      { task: 'write-text', message: 'Hello world!' },
    ]);
    const javascript = translator.translate(intermediate, 'meta', 'javascript');
    expect(javascript).toBe('process.stdout.write("Hello world!");\n');
    expect(translator.translate(javascript, 'javascript', 'meta')).toBe(
      intermediate
    );
    expect(
      translator.translate(intermediate, 'meta', 'rust', { form: 'rosetta' })
    ).toBe(source);
  });

  it('translates the C source and adapts the comments by default', () => {
    const result = translator.translateDetailed(cSource, 'c', 'csharp');
    expect(result.code).toBe(csharpSource);
    expect(result.document.interpretation.effect).toEqual(hello);
    expect(result.document.interpretation.requires).toEqual(['stdio.h']);
    expect(
      result.expression.network.link(result.expression.id).metadata().term
    ).toBe('hello');
    expect(
      result.expression.network.links().map((link) => link.metadata().term)
    ).toContain('System.Console.WriteLine');
    expect(
      translator.parse(result.code, 'csharp').interpretation.requires
    ).toEqual(['HelloWorld', 'System.Console']);
    expect(translate(cSource, 'c', 'csharp', { mode: 'literal' })).toContain(
      '// Print a line by function call.'
    );
    expect(
      translate(cSource, 'c', 'csharp', { mode: 'same-effect' })
    ).not.toContain('//');
  });

  it('keeps the greeting in the issue’s classic C source', () => {
    const source = cSource
      .replace('int main(void)', 'main()')
      .replace('    return 0;\n', '')
      .replace('Hello, World!', 'Hello World!');
    expect(translate(source, 'c', 'csharp')).toBe(
      csharpSource.replace('Hello, World!', 'Hello World!')
    );
  });

  it('restores mixed line endings, trivia, and Unicode bytes even without an interpretation', () => {
    const source = '/* 🐍 */\r\nunsupported(  \n tail  \r\n\r\n';
    const document = translator.parse(source, 'c');
    expect(document.interpretation).toBeUndefined();
    expect(translator.restore(document)).toBe(source);
    const unicode = translator.parse('code\r\n🐍é', 'c');
    const span = unicode.network
      .links()
      .find((link) => link.metadata().term === '🐍é')
      .metadata().span;
    expect([span.byteRange.start, span.byteRange.end]).toEqual([6, 12]);
    expect([span.start.row, span.start.column]).toEqual([1, 0]);
    expect([span.end.row, span.end.column]).toEqual([1, 6]);
    expect(() => translator.transform(document, 'javascript')).toThrow(
      'Unsupported program'
    );
    expect(translator.restore(translator.parse('', 'c'))).toBe('');
    const alternate = "// Hello World\r\nconsole.log('Hello, World!');";
    expect(translate(alternate, 'javascript', 'javascript')).toBe(alternate);
  });

  it('lists the complete authored roster by kind', () => {
    const languages = translator.listLanguages();
    expect(new Set(languages.map(({ id }) => id)).size).toBe(76);
    expect(languages.filter(({ kind }) => kind === 'programming').length).toBe(
      50
    );
    expect(
      languages.filter(({ kind }) => kind === 'natural-language').length
    ).toBe(20);
    expect(languages.filter(({ kind }) => kind === 'instruction').length).toBe(
      5
    );
    expect(
      languages.filter(({ kind }) => kind === 'meta-language').length
    ).toBe(1);
  });

  it('uses Links Notation as an explicit intermediate and preserves whole-line comments', () => {
    const intermediate = translator.translate(cSource, 'c', 'meta', {
      mode: 'literal',
    });
    expect(intermediate).toContain(`${writeEffect(hello)}\n`);
    expect(readEffects(intermediate)).toEqual([hello]);
    const span = translator.parse(intermediate, 'meta').interpretation.comments;
    expect(span.map(({ placement }) => placement)).toEqual(['leading', 'body']);
    expect(translator.translate(intermediate, 'meta', 'ja')).toContain(
      'Hello, World!'
    );
    expect(
      translator.translate(intermediate, 'meta', 'csharp', { mode: 'literal' })
    ).toContain('// Print a line by function call.');
    expect(readEffects(writeEffect({ task: 'hello', message: '' }))).toEqual([
      { task: 'hello', message: '' },
    ]);
    expect(() => readEffects('(hello: (message: Hi) (extra: 1))')).toThrow(
      'Invalid hello'
    );
    expect(() => readEffects('(fizz-buzz: (limit: 010))')).toThrow(
      'decimal integer'
    );
    expect(
      translator.parse(`${intermediate}${writeEffect(hello)}`, 'meta')
        .interpretation
    ).toBe(undefined);
  });

  for (const effect of effects) {
    it(`round-trips every ${effect.task} form and all directed pairs`, () => {
      const languages = translator.listLanguages();
      const admitted = languages.filter(({ forms }) =>
        forms.some(({ task }) => task === effect.task)
      );
      expect(admitted.length).toBe(expectedProfiles[effect.task]);
      for (const sourceLanguage of admitted) {
        for (const form of sourceLanguage.forms.filter(
          ({ task }) => task === effect.task
        )) {
          const source = translator.materialize(
            translator.expression(sourceLanguage.id, effect, {
              form: form.name,
            })
          );
          const document = translator.parse(source, sourceLanguage.id);
          expect(translator.restore(document)).toBe(source);
          expect(document.interpretation.effect).toEqual(effect);
          for (const targetLanguage of admitted) {
            const result = translator.transform(document, targetLanguage.id, {
              mode: 'same-effect',
            });
            const target = translator.materialize(result);
            expect(
              translator.parse(target, targetLanguage.id).interpretation.effect
            ).toEqual(effect);
          }
        }
      }
    }, 15000);
  }
});

it('preserves all 78 localized greetings in Unicode-capable profiles', () => {
  const effects = localizedGreetings();
  expect(effects.length).toBe(78);
  const profiles = languageProfiles().filter(
    ({ kind, unicodeGreeting }) =>
      kind === 'natural-language' || unicodeGreeting
  );
  expect(profiles.length).toBe(28);
  for (const effect of effects) {
    const intermediate = writeEffect(effect);
    for (const { id } of profiles) {
      const source = translator.translate(intermediate, 'meta', id);
      expect(translator.translate(source, id, 'meta')).toBe(
        `${intermediate}\n`
      );
    }
  }
  const welsh = writeEffect({ task: 'hello', message: "S'mae byd!" });
  expect(() => translator.translate(welsh, 'meta', 'cobol')).toThrow(
    'Unsupported hello'
  );
  expect(() =>
    translator.translate(welsh, 'meta', 'javascript', {
      form: 'single-quotes',
    })
  ).toThrow('Unsupported hello');
  expect(
    translator.parse("console.log('S'mae byd!');", 'javascript').interpretation
  ).toBeUndefined();
  expect(() =>
    writeEffect({ task: 'hello', message: '日'.repeat(33) })
  ).toThrow('outside the supported task domain');
}, 15000);

describe('translation rules and adapters', () => {
  it('applies ordered rule layers to the expression, then selects the requested style', () => {
    const custom = createTranslator({
      layers: [
        [
          (expression) => ({
            ...expression,
            comments: expression.comments.map((comment) => ({
              ...comment,
              text: comment.text === 'Привет' ? 'Hello' : comment.text,
            })),
          }),
        ],
        [(expression) => ({ ...expression, form: 'single-quotes' })],
      ],
    });
    const source = '// Привет\nconsole.log("Hello (World");\n';
    expect(custom.translate(source, 'javascript', 'javascript')).toBe(
      "// Hello\nconsole.log('Hello (World');\n"
    );
    const commonC = translate(cSource, 'c', 'c', { form: 'common' });
    expect(commonC).toContain('puts(message)');
    const commonCsharp = translate(commonC, 'c', 'csharp', { form: 'common' });
    expect(commonCsharp).toContain('PrintLine("Hello, World!")');
  });

  it('supports custom profiles and checks the output of decorated emitters', () => {
    const profiles = languageProfiles();
    const python = profiles.find(({ id }) => id === 'python');
    python.forms.push({
      task: 'hello',
      name: 'local-style',
      source: ['print( "{{message}}" )'],
    });
    const styled = createTranslator({ profiles });
    expect(
      styled.translate(cSource, 'c', 'python', {
        form: 'local-style',
        mode: 'same-effect',
      })
    ).toBe('print( "Hello, World!" )\n');
    const decorated = createTranslator({
      decorateAdapter: (id, adapter) =>
        id === 'python'
          ? {
              ...adapter,
              emit: (expression) =>
                adapter
                  .emit(expression)
                  .replace('Hello, World!', 'Other greeting'),
            }
          : adapter,
    });
    expect(() => decorated.translate(cSource, 'c', 'python')).toThrow(
      'failed the effect round trip'
    );
  });

  it('translates C# comment text in place and protects the source effect', () => {
    const custom = createTranslator({
      layers: [
        [
          (projection) => ({
            ...projection,
            comments: projection.comments.map((comment) => ({
              ...comment,
              text: comment.text.replace('Привет', 'Hello'),
            })),
            effect: { ...projection.effect, message: 'Different greeting' },
          }),
        ],
      ],
    });
    const source = csharpSource.replace('Hello World in C#', 'Привет');
    expect(custom.translate(source, 'csharp', 'csharp')).toBe(
      csharpSource
        .replace('Hello World in C#', 'Hello')
        .replace('Hello, World!', 'Different greeting')
    );
    expect(() =>
      custom.translate(source, 'csharp', 'csharp', { mode: 'same-effect' })
    ).toThrow('changed the source effect');
  });
});

describe('translation diagnostics', () => {
  it('refuses unadmitted code, effects, comment forms, and machine targets', () => {
    const invalid = [
      ['c', cSource.replace('#include <stdio.h>', '')],
      ['c', `// Swallows the next line \\\n${cSource}`],
      ['c', `/* safe */ side_effect(); /* unsafe */\n${cSource}`],
      ['php', '\n<?php\necho "Hello, World!\\n";\n'],
      ['php', '<?php\n// ?>\necho "Hello, World!\\n";\n'],
      ['javascript', 'console.log("Unexpected"); sendData();\n'],
      ['javascript', 'console.log("Hello%");\n'],
      ['javascript', 'console.log("Hello??/");\n'],
      [
        'javascript',
        'console.log("Hello, World!");\n// hidden\u2028side_effect();',
      ],
      ['javascript', 'console.log("Hello\n");\n'],
      ['lua', '--[=[\nprint("Hello, World!")\n'],
      [
        'java',
        '// \\u000a !\nclass Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}\n',
      ],
    ];
    for (const [language, source] of invalid) {
      expect(translator.parse(source, language).interpretation).toBeUndefined();
    }
    expect(() =>
      translator.expression('c', { task: 'fizz-buzz', limit: 1001 })
    ).toThrow('outside');
    expect(() =>
      translate(cSource.replace('Hello, World!', 'Greetings!'), 'c', 'cil')
    ).toThrow('Unsupported hello');
    expect(() => translate(cSource, 'c', 'binary')).toThrow(
      'Unsupported language'
    );
  });

  it('writes exact source to the CLI and returns a failure status for declined programs', () => {
    const source = 'print("Hi, user!")\r\n';
    const writes = [];
    const errors = [];
    const io = {
      read: () => source,
      write: (value) => writes.push(value),
      stderr: (value) => errors.push(value),
    };
    expect(runCli(['roundtrip', 'python'], io)).toBe(0);
    expect(runCli(['translate', 'python', 'javascript'], io)).toBe(0);
    expect(runCli(['translate', 'python', 'cil'], io)).toBe(1);
    expect(writes).toEqual([source, 'console.log("Hi, user!");\n']);
    expect(errors[0]).toContain('Unsupported hello');
  });
});

describe('dependent referents', () => {
  const { source, candidates } = referentInput();

  it('prefers round-trip evidence and retains unresolved readings', () => {
    const ranked = rankInterpretations(source, candidates);
    expect(ranked.preferred.map(({ id }) => id)).toEqual(['white-skin']);
    expect(ranked.candidates.map(({ confidence }) => confidence)).toEqual([
      [0.65, 0.65],
      [0.91, 0.91],
      [0, 0.29],
    ]);
    const narrowed = rankInterpretations(source, candidates, [
      'person',
      'white',
      'painted white',
    ]);
    expect(narrowed.preferred[0].id).toBe('painted-white');
    expect(
      rankInterpretations(source, candidates, ['plant']).candidates
    ).toEqual([]);
    const multiple = rankInterpretations(source, [
      candidates[0],
      { ...candidates[0], id: 'another-reading' },
    ]);
    expect(multiple.preferred.map(({ id }) => id)).toEqual([
      'another-reading',
      'white-skin',
    ]);
  });
});
