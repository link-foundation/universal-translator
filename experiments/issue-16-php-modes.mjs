// Bounded native document audit; --before substitutes the previous reader only.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTranslator } from '../js/src/index.js';
import { phpModeCases } from '../examples/runtime-headers/php-modes.mjs';

if (process.argv.includes('--regions')) {
  const translator = createTranslator();
  const source = '<b>😀</b><?php echo "ok" ?>\r\n<footer>end</footer>';
  const result = translator.translatePartial(source, 'php', 'python', {
    layout: 'target',
  });
  const slice = (text, span) =>
    Buffer.from(text).subarray(span.start, span.end).toString();
  console.log(
    JSON.stringify(
      {
        source,
        ...result,
        spelling: result.regionMap.map((pair) => [
          slice(source, pair.source),
          slice(result.text, pair.target),
        ]),
      },
      null,
      2
    )
  );
  process.exit(0);
}

const before = process.argv.includes('--before');
let parse;
if (before) {
  const oldModule = (path, replacements = {}) => {
    const source = execFileSync('git', ['show', `bb09ccd:${path}`], {
      encoding: 'utf8',
      maxBuffer: 256 * 1024,
    }).replace(
      /from '([.][^']+)'/g,
      (_, relative) =>
        `from ${JSON.stringify(replacements[relative] ?? new URL(relative, new URL(`../${path}`, import.meta.url)).href)}`
    );
    return `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  };
  const lexer = oldModule('js/src/formal/lexer.js');
  const sourceParser = oldModule('js/src/formal/source-parser.js', {
    './lexer.js': lexer,
  });
  ({ parseProgram: parse } = await import(
    oldModule('js/src/formal/parser.js', {
      './lexer.js': lexer,
      './source-parser.js': sourceParser,
    })
  ));
}
const translator = createTranslator(parse ? { parse } : {});
const directory = mkdtempSync(join(tmpdir(), 'translator-php-modes-'));
const options = { encoding: 'utf8', maxBuffer: 64 * 1024 };
const cases = [];
try {
  for (const [index, [source, expected]] of phpModeCases.entries()) {
    const file = join(directory, `case${index}.php`);
    writeFileSync(file, source);
    assert.equal(
      execFileSync(
        'php',
        ['-d', 'short_open_tag=0', '-d', 'memory_limit=32M', file],
        options
      ),
      expected
    );
    let error = null;
    let output;
    try {
      const python = translator.translate(source, 'php', 'python');
      output = execFileSync('python3', ['-c', python], options);
      assert.equal(output, expected);
    } catch (failure) {
      error = failure.message.slice(0, 600);
    }
    cases.push({ index, expected, output, error });
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
const failures = cases.filter(({ error }) => error).length;
console.log(
  JSON.stringify(
    { reader: before ? 'bb09ccd' : 'current', cases, failures },
    null,
    2
  )
);
process.exitCode = Number(failures > 0);
