import { describe, expect, it } from 'test-anywhere';
import { readFileSync } from 'node:fs';
import { createTranslator } from '../src/index.js';
import { naturalLanguageIds } from '../src/natural/catalog.js';
import { captureEmission } from '../src/translation/emission-map.js';

const translator = createTranslator();
const targetOptions = { fragment: true, layout: 'target' };
const java = `class Main {
    static int fib(int n) {
        return n;
    }
    public static void main(String[] args) {
        System.out.println(fib(5));
    }
}
`;

describe('semantic many-to-many line mapping', () => {
  it('maps the complete Fibonacci interpolation reported in issue 16', () => {
    const source = readFileSync('examples/translation/mapping.java', 'utf8');
    const bash = translator.translatePartial(
      source,
      'java',
      'bash',
      targetOptions
    );
    const print = source
      .split('\n')
      .findIndex((line) => line.includes('System.out.println'));
    const lines = bash.text.split('\n');
    const call = lines.findIndex(
      (line) => line.trim() === 'fibonacci "$index"'
    );
    const echo = lines.findIndex((line) =>
      line.includes('echo "fibonacci($index) = $REPLY"')
    );
    expect(call >= 0 && echo >= 0).toBe(true);
    expect(bash.lineMap.filter(([line]) => line === print)).toEqual([
      [print, call],
      [print, echo],
    ]);
    const restored = translator.translatePartial(
      bash.text,
      'bash',
      'java',
      targetOptions
    );
    const target = restored.text
      .split('\n')
      .findIndex((line) => line.includes('System.out.println'));
    expect(
      restored.lineMap.filter(([line]) => line === call || line === echo)
    ).toEqual([
      [call, target],
      [echo, target],
    ]);
  });

  it('maps a Java print to both the Bash command and its echo, and back', () => {
    const bash = translator.translatePartial(
      java,
      'java',
      'bash',
      targetOptions
    );
    expect(bash.complete).toBe(true);
    const lines = bash.text.split('\n');
    const call = lines.indexOf('fib 5');
    const echo = lines.indexOf('echo "$REPLY"');
    expect(call >= 0 && echo > call).toBe(true);
    expect(bash.lineMap.filter(([source]) => source === 5)).toEqual([
      [5, call],
      [5, echo],
    ]);
    const restored = translator.translatePartial(
      bash.text,
      'bash',
      'java',
      targetOptions
    );
    const print = restored.text
      .split('\n')
      .findIndex((line) => line.includes('System.out.println'));
    expect(
      restored.lineMap.filter(([source]) => source === call || source === echo)
    ).toEqual([
      [call, print],
      [echo, print],
    ]);
  });

  it('maps translated sentences in every controlled natural language in both directions', () => {
    const source = 'const x = 1;\nconsole.log(x + 2);\n';
    for (const id of naturalLanguageIds()) {
      const natural = translator.translatePartial(
        source,
        'javascript',
        id,
        targetOptions
      );
      expect(natural.complete).toBe(true);
      expect(natural.lineMap).toEqual([
        [0, 0],
        [1, 1],
      ]);
      const python = translator.translatePartial(
        natural.text,
        id,
        'python',
        targetOptions
      );
      expect(python.text).toBe('x = 1\nprint(x + 2)\n');
      expect(python.lineMap).toEqual([
        [0, 0],
        [1, 1],
      ]);
    }
  });

  it('preserves origin metadata through output style and fragment wrappers', () => {
    const source = '\n\nconst x = 1; console.log(x);\n';
    const result = translator.translatePartial(
      source,
      'javascript',
      'python',
      targetOptions
    );
    expect(result.text).toBe('x = 1\nprint(x)\n');
    expect(result.lineMap).toEqual([
      [2, 0],
      [2, 1],
    ]);
    const statement = translator.translatePartial(
      'return 1;\n',
      'c',
      'russian',
      targetOptions
    );
    expect(statement.complete).toBe(true);
    expect(statement.lineMap).toEqual([[0, 0]]);
  });

  it('restores the capture context after failure and reentrant translations', () => {
    expect(() =>
      captureEmission(() => {
        throw new Error('probe');
      })
    ).toThrow('probe');
    const outer = captureEmission(() => {
      translator.translatePartial('console.log(9);\n', 'javascript', 'python');
      return translator.translatePartial(
        'console.log(8);\n',
        'javascript',
        'russian'
      );
    });
    expect(outer.emissions).toEqual([]);
    expect(outer.result.lineMap).toEqual([[0, 0]]);
    expect(
      translator.toMeta('console.log(1);', 'javascript').main.statements[0]
    ).toEqual({
      kind: 'Print',
      value: { kind: 'Number', value: 1, type: 'integer' },
      newline: true,
    });
  });
});
