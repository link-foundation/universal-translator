import { describe, expect, it } from 'test-anywhere';

import { createTranslator } from '../src/index.js';

const source = 'console.log("Hi");\n';

describe('decorating the stages of the pipeline', () => {
  it('runs a decorator that traces the calls of a stage', () => {
    const calls = [];
    const translator = createTranslator({
      decorate: {
        parse: (next) => (text, syntax) => {
          calls.push(['parse', syntax.id]);
          return next(text, syntax);
        },
        emit: (next) => (meta, to) => {
          calls.push(['emit', to]);
          return next(meta, to);
        },
      },
    });
    expect(translator.translate(source, 'javascript', 'python')).toBe(
      createTranslator().translate(source, 'javascript', 'python')
    );
    expect(calls).toEqual([
      ['parse', 'javascript'],
      ['emit', 'python'],
    ]);
  });

  it('rewrites the output of the emitter', () => {
    const shout = (next) => (meta, to) => next(meta, to).toUpperCase();
    const translator = createTranslator().decorate('emit', shout);
    expect(translator.translate(source, 'javascript', 'python')).toBe(
      'PRINT("HI")\n'
    );
  });

  it('rewrites the input of the parser', () => {
    const translator = createTranslator({
      decorate: {
        parse: (next) => (text, syntax) =>
          next(text.replace('Hi', 'Bye'), syntax),
      },
    });
    expect(translator.translate(source, 'javascript', 'python')).toBe(
      'print("Bye")\n'
    );
  });

  it('composes the decorators of one stage in order, the last outermost', () => {
    const order = [];
    const named = (name) => (next) => (meta, to) => {
      order.push(`${name} in`);
      const text = next(meta, to);
      order.push(`${name} out`);
      return `${name}(${text.trim()})`;
    };
    const translator = createTranslator({
      decorate: { emit: [named('first'), named('second')] },
    });
    expect(translator.translate(source, 'javascript', 'python')).toBe(
      'second(first(print("Hi")))'
    );
    expect(order).toEqual(['second in', 'first in', 'first out', 'second out']);
  });

  it('adds decorators with decorate() without changing the translator', () => {
    const plain = createTranslator();
    const marked = plain.decorate(
      'emit',
      (next) => (meta, to) => `# ${to}\n${next(meta, to)}`
    );
    const twice = marked.decorate({
      emit: (next) => (meta, to) => next(meta, to).replace('Hi', 'Hello'),
    });
    expect(plain.translate(source, 'javascript', 'python')).toBe(
      'print("Hi")\n'
    );
    expect(marked.translate(source, 'javascript', 'python')).toBe(
      '# python\nprint("Hi")\n'
    );
    expect(twice.translate(source, 'javascript', 'python')).toBe(
      '# python\nprint("Hello")\n'
    );
  });

  it('keeps the decorators when the rules change', () => {
    const translator = createTranslator()
      .decorate('emit', (next) => (meta, to) => `${next(meta, to)}# done\n`)
      .withRules({ names: [{ find: 'x', replace: 'y' }] });
    expect(translator.translate('const x = 1;\n', 'javascript', 'python')).toBe(
      'y = 1\n# done\n'
    );
  });
});

describe('decorating the other stages', () => {
  it('wraps the readers and the writer of words', () => {
    const seen = [];
    const translator = createTranslator({
      decorate: {
        readNatural: (next) => (words, id, language) => {
          seen.push(['read', id]);
          return next(words, id, language);
        },
        writeNatural: (next) => (meta, to) => {
          seen.push(['write', to]);
          return next(meta, to);
        },
      },
    });
    const words = translator.translate(source, 'javascript', 'english');
    translator.translate(words, 'english', 'python');
    expect(seen).toEqual([
      ['write', 'english'],
      ['read', 'english'],
    ]);
  });

  it('wraps the machine code reader, lifting and emitter', () => {
    const seen = [];
    const trace =
      (stage) =>
      (next) =>
      (...input) => {
        seen.push(stage);
        return next(...input);
      };
    const translator = createTranslator({
      decorate: {
        emitMachineCode: trace('emitMachineCode'),
        readMachine: trace('readMachine'),
        lift: trace('lift'),
        infer: trace('infer'),
      },
    });
    const assembly = translator.translate(source, 'javascript', 'nasm');
    translator.translate(assembly, 'nasm', 'python');
    expect(seen).toEqual([
      'infer',
      'emitMachineCode',
      'readMachine',
      'lift',
      'infer',
    ]);
  });

  it('wraps a replacement of a stage', () => {
    const translator = createTranslator({
      emit: () => 'replaced',
      decorate: { emit: (next) => (meta, to) => `[${next(meta, to)}]` },
    });
    expect(translator.translate(source, 'javascript', 'python')).toBe(
      '[replaced]'
    );
  });

  it('rejects unknown stages and decorators that are not functions', () => {
    expect(() => createTranslator({ decorate: { lexer: () => {} } })).toThrow(
      'Unknown stage "lexer"'
    );
    expect(() => createTranslator({ decorate: { emit: 'loud' } })).toThrow(
      'A decorator of "emit" must be a function'
    );
    expect(() => createTranslator({ decorate: { emit: () => 1 } })).toThrow(
      'must return a function'
    );
  });
});
