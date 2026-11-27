import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'test-anywhere';
import { createTranslator } from '../src/index.js';
import { meaningDifference, walk } from '../src/meta/tree.js';
import { objectiveCRuntimeHeader } from '../src/formal/dialects/objc.js';
import { tokenize } from '../src/formal/lexer.js';
import { languageSyntax } from '../src/formal/languages.js';

const source = readFileSync(
  new URL('../../examples/objpak/conditions.m', import.meta.url),
  'utf8'
);
const translator = createTranslator();

describe('Objective-C condition types', () => {
  it('preserves boolean calls and normalizes numeric calls after inference', () => {
    const meta = translator.toMeta(source, 'objc');
    const conditions = [];
    walk(meta, (current) => {
      if (['While', 'If'].includes(current.kind)) {
        conditions.push(current.condition);
      }
    });
    expect(
      conditions.map((condition) => [condition.kind, condition.type])
    ).toEqual([
      ['Call', 'boolean'],
      ['Binary', 'boolean'],
    ]);
    expect(conditions[1].operator).toBe('notEqual');
    expect(meta.functions[0].parameters[0].type).toBe('boolean');
    expect(meta.functions[1].parameters).toEqual([]);
    for (const language of ['python', 'javascript', 'rust', 'objc']) {
      const output = translator.translate(source, 'objc', language);
      expect({
        language,
        difference: meaningDifference(
          meta,
          translator.toMeta(output, language)
        ),
      }).toEqual({ language, difference: undefined });
    }
  });

  it('reads the C-family void parameter marker without inventing a variable', () => {
    for (const language of ['c', 'cpp', 'objc']) {
      const meta = translator.toMeta(
        'int remaining(\nvoid) { return 2; }',
        language
      );
      expect(meta.functions[0].parameters).toEqual([]);
    }
    const python = translator.toMeta(
      'def identity(void):\n    return void\n',
      'python'
    );
    expect(python.functions[0].parameters[0].name).toBe('void');
  });

  it('preserves boolean variable conditions and types every numeric test', () => {
    const meta = translator.toMeta(
      'int main(void) { BOOL active = YES; int left = 2; while (active) { active = NO; } if (left) { left--; } return 0; }',
      'objc'
    );
    expect(meta.main.statements[2].condition.kind).toBe('Name');
    expect(meta.main.statements[2].condition.type).toBe('boolean');
    expect(meta.main.statements[3].condition.type).toBe('boolean');
    expect(meta.main.statements[3].condition.right.type).toBe('integer');
    expect(translator.fromMeta(meta, 'rust')).toContain('while active');
  });

  it('retains the runtime header as one concrete directive and rejects conditional code', () => {
    const tokens = tokenize(
      `${objectiveCRuntimeHeader}\nBOOL active = YES;`,
      languageSyntax('objc')
    );
    expect(tokens[0].type).toBe('directive');
    expect(tokens[0].value).toBe(objectiveCRuntimeHeader);
    expect(tokens[0].rawSpan).toEqual([0, objectiveCRuntimeHeader.length]);
    expect(tokens.find((token) => token.value === 'BOOL').line).toBe(6);
    expect(() =>
      translator.toMeta(
        objectiveCRuntimeHeader.replace('#else', 'printf("changed");\n#else'),
        'objc'
      )
    ).toThrow();
  });
});
