// The forms the programs of the Hello World Collection use (issue 1, item
// 1.3): fixed-form Fortran with format statements, Fortran 90 write
// statements, Lua and Groovy calls without parentheses, the PHP closing
// tag, Scala's `extends App`, a Visual Basic class after Imports
// System.Console and Zig before 0.1. The Rust twin is
// rust/tests/hello_world_dialects.rs.
import { describe, expect, it } from 'test-anywhere';

import { translate } from '../src/index.js';

const toJavaScript = (source, from) => translate(source, from, 'javascript');

describe('Fortran output statements', () => {
  it('reads write control lists, new_line and the // operator', () => {
    const source = [
      'program p',
      "write (*, '(a)', advance='no') 'a'",
      "write (*, *) 'b', 1",
      "print *, 'x' // new_line('a') // 'y'",
      "print *, 'a' // 'b'",
      'end program p',
      '',
    ].join('\n');
    expect(toJavaScript(source, 'fortran')).toBe(
      'process.stdout.write("a");\nconsole.log(`b${1}`);\nconsole.log("x\\ny");\nconsole.log("ab");\n'
    );
  });

  it('writes a line end inside text with new_line', () => {
    expect(
      translate('console.log("a\\nb");\n', 'javascript', 'fortran')
    ).toContain("'a' // new_line('a') // 'b'");
  });

  it('reads fixed-form comments, labelled formats and a final stop', () => {
    const source = [
      '*     Star comment',
      '      PROGRAM P',
      'c     lower comment',
      '      WRITE (*,10)',
      '      STOP',
      "   10 FORMAT ('a' // 'b' /)",
      '      END',
      '',
    ].join('\n');
    expect(toJavaScript(source, 'fortran')).toBe(
      '//     Star comment\n//     lower comment\nconsole.log("a\\n\\nb\\n");\n'
    );
  });

  it('keeps an assignment to c a statement, not a comment', () => {
    const source =
      'program p\ninteger :: c\nc = 1\nprint *, c\nend program p\n';
    expect(toJavaScript(source, 'fortran')).toBe(
      'const c = 1;\nconsole.log(c);\n'
    );
  });

  it('reports formats it cannot print', () => {
    const cases = [
      ['      WRITE (*,200)\n', 'No format statement labelled 200'],
      [
        "      WRITE (*,100) 1\n  100 FORMAT ('a')\n",
        'Items written with a format statement',
      ],
      [
        '      WRITE (*,100)\n  100 FORMAT (I5)\n',
        'Edit descriptor "I5" in a format statement',
      ],
    ];
    for (const [body, message] of cases) {
      const source = `      PROGRAM P\n${body}      END\n`;
      expect(() => toJavaScript(source, 'fortran')).toThrow(message);
    }
  });
});

describe('calls and layouts of the other collection programs', () => {
  it('reads PHP closing tags and following literal output', () => {
    expect(toJavaScript("<?php\necho 'a';\n?>\n", 'php')).toBe(
      'process.stdout.write("a");\n'
    );
    expect(toJavaScript("<?php\necho 'a';\n?>\ntext\n", 'php')).toBe(
      'process.stdout.write("a");\nprocess.stdout.write("text\\n");\n'
    );
  });

  it('reads a Lua #! line and a call with one text argument', () => {
    expect(toJavaScript('#!/usr/bin/lua\nprint "a"\n', 'lua')).toBe(
      '// !/usr/bin/lua\nconsole.log("a");\n'
    );
  });

  it('reads Groovy println without parentheses', () => {
    expect(toJavaScript('println "a"\n', 'groovy')).toBe('console.log("a");\n');
  });

  it('reads a Scala object that extends App', () => {
    const source = 'object Main extends App {\n  println("a")\n}\n';
    expect(toJavaScript(source, 'scala')).toBe('console.log("a");\n');
  });

  it('reads a Visual Basic class after Imports System.Console', () => {
    const source = [
      'Imports System.Console',
      'Class C',
      '    Public Shared Sub Main()',
      '        WriteLine("a")',
      '        Write("b")',
      '    End Sub',
      'End Class',
      '',
    ].join('\n');
    expect(toJavaScript(source, 'vb')).toBe(
      'console.log("a");\nprocess.stdout.write("b");\n'
    );
    const module =
      'Module M\n    Sub Main()\n        WriteLine("a")\n    End Sub\nEnd Module\n';
    expect(toJavaScript(module, 'vb')).toBe('WriteLine("a");\n');
  });

  it('reads Zig before 0.1', () => {
    const source = [
      'const io = @import("std").io;',
      'pub fn main(args: [][]u8) -> %void {',
      '    %%io.stdout.printf("a {}\\n", 1);',
      '}',
      '',
    ].join('\n');
    expect(toJavaScript(source, 'zig')).toBe('console.log(`a ${1}`);\n');
  });
});
