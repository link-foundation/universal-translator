import { describe, it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TextEncoder } from 'node:util';
import {
  createTranslator,
  naturalLanguageIds,
  checkDescription,
  checkText,
} from '../src/index.js';
import { sameMeaning, walk } from '../src/meta/tree.js';
import { parseProgram } from '../src/formal/parser.js';
import { languageSyntax } from '../src/formal/languages.js';
import { objpakRuntime } from '../src/formal/objpak-runtime.js';
import { objpakSource } from '../src/formal/objpak-reader.js';

const t = createTranslator();
const source = readFileSync(
  new URL('../../examples/objpak/hello.m', import.meta.url),
  'utf8'
);
const kinds = (tree, kind) => {
  const result = [];
  walk(tree, (n) => {
    if (n.kind === kind) {
      result.push(n);
    }
  });
  return result;
};

describe('Portable Object Compiler messages and Objpak collections', () => {
  it('parses receivers, multi-part selectors and block parameters independently', () => {
    const tree = parseProgram(
      '[receiver first:1 second:[String str:"text"]]; [items do:{ :one :two | printf("%s", [one str]); }];',
      languageSyntax('objc')
    );
    assert.equal(
      kinds(tree, 'Message').find((n) => n.selector === 'first:second:')
        .selector,
      'first:second:'
    );
    assert.equal(
      kinds(tree, 'Message').find((n) => n.selector === 'first:second:')
        .arguments.length,
      2
    );
    assert.deepEqual(kinds(tree, 'BlockLambda')[0].parameters, ['one', 'two']);
  });

  it('reads the original collection example into argument, update and set concepts', () => {
    const meta = t.toMeta(source, 'objc');
    for (const kind of ['Message', 'Dereference', 'BlockLambda']) {
      assert.equal(kinds(meta, kind).length, 0, kind);
    }
    assert.equal(kinds(meta, 'ProcessArguments')[0].includeProgram, true);
    assert.equal(kinds(meta, 'SetLiteral')[0].order, 'objpak-string');
    assert.equal(kinds(meta, 'SetInsert').length, 1);
    assert.equal(kinds(meta, 'ForEach')[0].array.type, 'set<text>');
    assert.equal(
      kinds(meta, 'ForEach')[0].body.statements[0].value.parts[1].type,
      'text'
    );
    assert.equal(kinds(meta, 'Update').length, 2);
  });

  it('handles renamed entries, whitespace, braces and duplicate literals compositionally', () => {
    const input =
      'int main(int total, char **words) { id names = [ Set\n new ]; words++; while (--total) { [names add:[String str:*words++]]; } [names add:[String str:"Alice"]]; [names do:{ :person | printf("%s\\n", [person str]); }]; return 0; }';
    const meta = t.toMeta(input, 'objc');
    assert.equal(kinds(meta, 'SetInsert').length, 2);
    assert.equal(kinds(meta, 'Message').length, 0);
    assert.match(t.fromMeta(meta, 'python'), /names.add\("Alice"\)/u);
  });

  it('does not guess unknown library messages or unsupported pointer uses', () => {
    assert.equal(
      kinds(t.toMeta('[unknown add:1];', 'objc'), 'Message').length,
      1
    );
    assert.throws(
      () =>
        t.toMeta('int main(int count, char **args) { consume(args); }', 'objc'),
      /Command-line pointers/u
    );
  });

  it('keeps aliases as references and models insertion as returning its set', () => {
    const meta = t.toMeta(
      'id first = [Set new]; id second = first; id third = [second add:[String str:"name"]]; [first do:{ :person | printf("%s\\n", [person str]); }];',
      'objc'
    );
    assert.equal(kinds(meta, 'Message').length, 0);
    assert.match(t.fromMeta(meta, 'rust'), /let second = first.clone\(\);/u);
    assert.match(t.fromMeta(meta, 'rust'), /let third = second.clone\(\).add/u);
  });

  it('rejects editions without the required runtime constructs', () => {
    const meta = t.toMeta(source, 'objc');
    assert.throws(() => t.fromMeta(meta, 'javascript@es5'), /ECMAScript 2015/u);
    for (const version of ['2', '3.5']) {
      assert.throws(() => t.fromMeta(meta, `python@${version}`), /Python 3.8/u);
    }
  });
});

describe('Objpak expressions in controlled natural languages', () => {
  it('round-trips the full algorithm through every natural grammar', () => {
    const meta = t.toMeta(source, 'objc');
    for (const language of naturalLanguageIds()) {
      const written = t.fromMeta(meta, language);
      assert.deepEqual(checkDescription(language), [], language);
      assert.ok(
        sameMeaning(meta, t.toMeta(written, language)),
        `${language}: ${written}`
      );
    }
  });

  it('distinguishes an empty set from the identical quoted text and uses no extra vocabulary', () => {
    for (const language of naturalLanguageIds()) {
      const written = t.translate('id people = [Set new];', 'objc', language);
      assert.deepEqual(
        checkText(written, language),
        [],
        `${language}: ${written}`
      );
      assert.equal(kinds(t.toMeta(written, language), 'SetLiteral').length, 1);
      const text = t.translate(
        'printf("objpak-string-set");',
        'objc',
        language
      );
      assert.equal(kinds(t.toMeta(text, language), 'SetLiteral').length, 0);
    }
  });
});

describe('generated Objpak library contracts', () => {
  it('round-trips generated callers through four formal grammars', () => {
    const meta = t.toMeta(source, 'objc');
    for (const language of ['objc', 'javascript', 'python', 'rust']) {
      const written = t.fromMeta(meta, language);
      assert.ok(
        sameMeaning(meta, t.toMeta(written, language)),
        `${language}: ${written}`
      );
    }
  });
  it('returns a successful status from a generated C89 entry point', () => {
    const written = t.translate('printf("done\\n");', 'objc', 'objc');
    assert.match(written, /return 0;\n\}/u);
    assert.ok(
      sameMeaning(
        t.toMeta('printf("done\\n");', 'objc'),
        t.toMeta(written, 'objc')
      )
    );
  });
  it('reads source layout and explicit indentation and brace styles', () => {
    const meta = t.toMeta(source, 'objc');
    for (const language of ['objc', 'javascript', 'python', 'rust']) {
      for (const options of [
        {},
        { indent: 2, braces: 'next-line' },
        { indent: 'tab' },
      ]) {
        const written = t.translate(source, 'objc', language, options);
        assert.ok(
          sameMeaning(meta, t.toMeta(written, language)),
          `${language}: ${JSON.stringify(options)}: ${written}`
        );
      }
    }
  });
  it('rejects a line break that changes JavaScript return semantics', () => {
    const definition = objpakRuntime.javascript.replaceAll(
      '$SET$',
      'UtObjpakSet'
    );
    const changed = definition.replace('return hash;', 'return\nhash;');
    assert.deepEqual(
      objpakSource(changed, 'javascript', languageSyntax('javascript'))
        .bindings,
      []
    );
  });
  it('rejects whitespace that splits an operator or numeric literal', () => {
    for (const [language, before, after] of [
      ['javascript', '>>> 0', '>> > 0'],
      ['python', '0xffffffff', '0 xffffffff'],
    ]) {
      const definition = objpakRuntime[language].replaceAll(
        '$SET$',
        'UtObjpakSet'
      );
      assert.ok(definition.includes(before), language);
      assert.deepEqual(
        objpakSource(
          definition.replace(before, after),
          language,
          languageSyntax(language)
        ).bindings,
        [],
        language
      );
    }
  });
});

describe('Objpak concrete records and scopes', () => {
  it('preserves the concrete library bytes and refuses a modified helper contract', () => {
    const meta = t.toMeta(source, 'objc');
    for (const language of ['objc', 'javascript', 'python', 'rust']) {
      const prefix = `${language === 'python' ? '#' : '//'} 🦀 Привет\n`;
      const written = prefix + t.fromMeta(meta, language);
      const parsed = parseProgram(written, languageSyntax(language));
      assert.equal(parsed.syntax.children.map((n) => n.text).join(''), written);
      let offset = 0;
      for (const child of parsed.syntax.children) {
        assert.equal(child.start, offset);
        offset += new TextEncoder().encode(child.text).length;
        assert.equal(child.end, offset);
      }
      assert.equal(offset, new TextEncoder().encode(written).length);
      assert.deepEqual(parsed.objpakBindings, ['UtObjpakSet']);
      assert.ok(
        parsed.syntax.children.some((n) => n.type === 'library-definition')
      );
      assert.ok(
        parsed.syntax.productions.some((n) => n.concept === 'LibraryDefinition')
      );
      assert.throws(() =>
        t.toMeta(
          written.replace(
            language === 'objc'
              ? 'int index = 0;'
              : language === 'python'
                ? '[None] * 16'
                : language === 'javascript'
                  ? 'new Array(16)'
                  : 'vec![None; 16]',
            language === 'objc'
              ? 'int index = 1;'
              : language === 'python'
                ? '[None] * 17'
                : language === 'javascript'
                  ? 'new Array(17)'
                  : 'vec![None; 17]'
          ),
          language
        )
      );
    }
  });
  it('does not assign library contracts to comments, literals or nested definitions', () => {
    for (const language of ['objc', 'javascript', 'python', 'rust']) {
      const definition = objpakRuntime[language].replaceAll(
        '$SET$',
        'UtObjpakSet'
      );
      const syntax = languageSyntax(language);
      for (const wrapped of language === 'python'
        ? [
            `'''\n${definition}\n'''`,
            `def local():\n${definition.replace(/^/gmu, '    ')}`,
          ]
        : [`/*\n${definition}\n*/`, `void local() {\n${definition}\n}`]) {
        assert.deepEqual(
          objpakSource(wrapped, language, syntax).bindings,
          [],
          language
        );
      }
    }
  });
  it('distinguishes prefix and postfix results and protects a previous variable', () => {
    const meta = t.toMeta(
      'int previous = 3; printf("%d\\n", previous++); printf("%d\\n", --previous); printf("%d\\n", previous--); printf("%d\\n", ++previous);',
      'objc'
    );
    assert.deepEqual(
      kinds(meta, 'Update').map(({ delta, prefix }) => [delta, prefix]),
      [
        [1, false],
        [-1, true],
        [-1, false],
        [1, true],
      ]
    );
    for (const language of ['javascript', 'python', 'rust', 'objc']) {
      const written = t.fromMeta(meta, language);
      assert.ok(
        sameMeaning(meta, t.toMeta(written, language)),
        `${language}: ${written}`
      );
    }
  });
  it('respects parameters shadowing native library class names', () => {
    const meta = t.toMeta(
      'void example(id Set, id String) { id names = [Set new]; id value = [String str:"text"]; }',
      'objc'
    );
    assert.equal(kinds(meta, 'Message').length, 2);
    assert.equal(kinds(meta, 'SetLiteral').length, 0);
  });
});
