// Nested grammars: comments and strings read with the grammars they are
// written in, each long text kept a single time under an id. The Rust twin
// is rust/tests/nesting.rs.
import { describe, expect, it } from 'test-anywhere';

import { runCli } from '../../bin/universal-translator.js';
import {
  createTranslator,
  formatMeta,
  nestGrammars,
  readProse,
  unnest,
} from '../src/index.js';

const translator = createTranslator();

const nested = (source, language) =>
  nestGrammars(translator.toMeta(source, language), language, translator);

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

const long =
  'This program reads a list of numbers, adds them together and prints the sum of all of them';

describe('nested grammars', () => {
  it('reads a comment as prose and the code it quotes', () => {
    const meta = nested(
      '// Prints `x + 1` twice\nconst x = 1;\nconsole.log(x + 1);\n',
      'javascript'
    );
    const text = formatMeta(meta);
    expect(text).toContain(
      [
        "  comment 'Prints `x + 1` twice'",
        '    prose english',
        '      sentence',
        '        word Prints (concept print) (part verb)',
        '        code javascript',
        '          program',
        '            evaluate',
        '              binary add (type integer)',
      ].join('\n')
    );
  });

  it('reads a string as code when it looks like code', () => {
    const text = formatMeta(
      nested('code = "print(1 + 2)"\nprint(code)\n', 'python')
    );
    expect(text).toContain(
      "    text 'print(1 + 2)' (type text)\n      code python\n        program\n          call print-line"
    );
  });

  it('reads Russian prose, a question and its phrases', () => {
    const text = formatMeta(
      nested(
        '// Как хорошо покакать?\nconsole.log("Привет мир");\n',
        'javascript'
      )
    );
    expect(text).toContain(
      [
        '    prose russian',
        '      sentence (question true)',
        "        word 'Как хорошо' (concept how-good) (part phrase)",
        '        word покакать (concept poop) (part verb)',
      ].join('\n')
    );
    expect(text).toContain(
      '          word Привет (concept hello) (part interjection)'
    );
  });

  it('keeps a long text once and refers to it by id', () => {
    const source = `// ${long}\nconst message = "${long}";\nconsole.log(message);\n`;
    const meta = translator.toMeta(source, 'javascript');
    const deep = nestGrammars(meta, 'javascript', translator);
    expect(deep.texts.map(({ id, text }) => [id, text])).toEqual([
      ['text-1', long],
    ]);
    const text = formatMeta(deep);
    expect(text).toContain('  comment (reference text-1)\n');
    expect(text).toContain('    text (reference text-1) (type text)\n');
    expect(text).not.toContain(`comment '${long}'`);
    expect(unnest(deep)).toEqual(meta);
  });

  it('reads the comment lists of a program', () => {
    const source =
      '# Hello world\ndef twice(x):\n    return x * 2\n\nprint(twice(1))\n';
    const meta = translator.toMeta(source, 'python');
    const deep = nestGrammars(meta, 'python', translator);
    expect(formatMeta(deep)).toContain(
      "  function twice (blank-after true) (return-type integer)\n    comment 'Hello world'\n      prose english\n"
    );
    expect(unnest(deep)).toEqual(meta);
  });

  it('translates a nested program like the plain one', () => {
    const source = `// ${long}\nconst message = "${long}";\nconsole.log(message);\n`;
    const deep = nested(source, 'javascript');
    expect(translator.fromMeta(deep, 'python')).toBe(
      translator.translate(source, 'javascript', 'python')
    );
  });

  it('leaves text without a known word unread', () => {
    expect(readProse('zzqx vvqk')).toBe(undefined);
    expect(readProse('Hello world').sentences[0].words[0]).toEqual({
      kind: 'Word',
      text: 'Hello',
      concept: 'hello',
      part: 'interjection',
    });
  });

  it('prints the nested meta program on the command line, --shallow the plain one', () => {
    const source = '# Hello world\nprint(1)\n';
    expect(cli(['meta', 'python', '-'], source).output).toContain(
      "comment 'Hello world'\n    prose english\n"
    );
    expect(cli(['meta', 'python', '-', '--shallow'], source).output).toBe(
      formatMeta(translator.toMeta(source, 'python'))
    );
    expect(
      JSON.parse(
        cli(['meta', 'python', '-', '--json', '--shallow'], source).output
      )
    ).toEqual(translator.toMeta(source, 'python'));
  });
});
