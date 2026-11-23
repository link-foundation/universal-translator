import { describe, expect, it } from 'test-anywhere';
import { runCli } from '../../bin/universal-translator.js';
import {
  createSourceSyntaxCodec,
  readSourceDocument,
  writeSourceDocument,
} from '../src/index.js';

describe('Links Notation source documents', () => {
  it('preserves line endings, BOM, blank lines, and final text', () => {
    const language = 'Language outside the effect catalog';
    for (const source of ['', '\n', '\ufeffa\r\n\r\n# 🦀\0\t', 'a\n🦀\n']) {
      const notation = writeSourceDocument(language, source);
      expect(readSourceDocument(notation)).toEqual({ language, source });
    }
  });

  it('rejects malformed records and line boundaries', () => {
    const valid = writeSourceDocument('Rust', 'abc');
    for (const notation of [
      '',
      '(source-document: (line: missing-language))',
      '(source-document: (language: Rust) (line: abc) (line: def))',
      `${valid}\n${valid}`,
    ]) {
      expect(() => readSourceDocument(notation)).toThrow();
    }
    expect(() => writeSourceDocument('', 'x')).toThrow();
    expect(() => writeSourceDocument('Rust', '\ud800')).toThrow();
  });

  it('passes source through the CLI without changing bytes or adding a newline', () => {
    const source = 'hello\r\nworld';
    let notation;
    let restored;
    expect(
      runCli(['encode-source', 'Source Language'], {
        read: () => source,
        write: (output) => (notation = output),
      })
    ).toBe(0);
    expect(
      runCli(['decode-source'], {
        read: () => notation,
        write: (output) => (restored = output),
      })
    ).toBe(0);
    expect(restored).toBe(source);
  });
});

describe('Meta Language source syntax', () => {
  it('requires a parser with grammar provenance', () => {
    expect(() => createSourceSyntaxCodec()).toThrow('grammar provenance');
  });
});
