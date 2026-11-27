import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'test-anywhere';
import { createTranslator, detectLanguage } from '../src/index.js';

const translator = createTranslator();
const source = readFileSync(
  new URL('../../examples/translation/exceptions.cpp', import.meta.url),
  'utf8'
);

function execute(source, language) {
  const result = spawnSync(
    language === 'python' ? 'python3' : 'node',
    [language === 'python' ? '-c' : '-e', source],
    { encoding: 'utf8' }
  );
  expect(result.stderr).toBe('');
  return result.status;
}

describe('typed exception handling', () => {
  it('distinguishes a try body, typed handler and throw value', () => {
    const meta = translator.toMeta(source, 'cpp');
    const [attempt] = meta.main.statements;
    expect(attempt.kind).toBe('Try');
    expect(attempt.body.statements[1].kind).toBe('Throw');
    expect(attempt.body.statements[1].value.value).toBe(8);
    expect(attempt.handlers[0].type).toBe('integer');
    expect(attempt.handlers[0].body.statements[0].value.type).toBe('integer');
  });

  it('executes the issue example with the same exit status', () => {
    for (const target of ['python', 'javascript']) {
      expect(execute(translator.translate(source, 'cpp', target), target)).toBe(
        8
      );
    }
  });

  it('lowers a local C++ integer throw and catch to C control flow', () => {
    const result = translator.translatePartial(source, 'cpp', 'c');
    expect(result.complete).toBe(true);
    expect(result.text).toContain('goto _ut_dispatch');
    expect(result.text).toContain('int e = _ut_payload');
  });

  it('rejects C exception paths that need a different type or unwinding', () => {
    for (const [text, error] of [
      [source.replace('throw 8;', 'throw 010;'), /portable C\+\+ int literal/],
      [
        source.replace('throw 8;', 'throw 40000;'),
        /portable C\+\+ int literal/,
      ],
      [
        source.replace('catch (int e)', 'catch (int &e)'),
        /known C\+\+ catch type/,
      ],
      [source.replace('throw 8;', 'unknown(); throw 8;'), /cannot unwind Call/],
      [
        source.replace('catch (int e)', 'catch (double e)'),
        /local matching handler/,
      ],
    ]) {
      expect(() => translator.translate(text, 'cpp', 'c')).toThrow(error);
    }
  });

  it('detects the source as C++ after a complete parse', () => {
    expect(detectLanguage(source)[0].id).toBe('cpp');
  });

  it('matches the thrown type and skips mismatched handlers', () => {
    const source =
      'int main() { try { throw 8; } catch (double realError) { return 3; } catch (int caughtError) { return caughtError; } }';
    for (const target of ['python', 'javascript']) {
      expect(execute(translator.translate(source, 'cpp', target), target)).toBe(
        8
      );
    }
  });

  it('preserves a catch-all and nested rethrow', () => {
    const source =
      'int main() { try { try { throw 8; } catch (...) { throw; } } catch (int e) { return e; } }';
    for (const target of ['python', 'javascript']) {
      expect(execute(translator.translate(source, 'cpp', target), target)).toBe(
        8
      );
    }
  });

  it('preserves user bindings around runtime carriers', () => {
    const source =
      'int main() { int _ut_error0 = 5; try { throw 8; } catch(int e) { return _ut_error0 + e; } }';
    expect(
      execute(translator.translate(source, 'cpp', 'python'), 'python')
    ).toBe(13);
  });

  it('retains finally execution when a function returns', () => {
    const source = `function result() {
  try { return 8; } finally { console.log(1); }
}
console.log(result());`;
    for (const target of ['python', 'javascript']) {
      const translation = translator.translate(source, 'javascript', target);
      const result = spawnSync(
        target === 'python' ? 'python3' : 'node',
        [target === 'python' ? '-c' : '-e', translation],
        { encoding: 'utf8' }
      );
      expect(result.stderr).toBe('');
      expect(result.status).toBe(0);
      expect(result.stdout).toBe('1\n8\n');
    }
  });

  it('writes typed exception statements as fragments', () => {
    const result = translator.translatePartial(
      'try { throw 8; } catch (int e) { return e; }',
      'cpp',
      'python',
      { fragment: true }
    );
    expect(result.complete).toBe(true);
    expect(result.text).toContain('except BaseException');
    expect(result.text).toContain('return e');
    expect(result.text.includes('SystemExit')).toBe(false);
  });
});
