// Finite native probe of floor division/modulo versus truncation/remainder.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createTranslator } from '../js/src/index.js';

const pairs = [-7, -6, -1, 0, 1, 6, 7].flatMap((a) =>
  [-3, -2, 2, 3].map((b) => [a, b])
);
const python = pairs
  .flatMap(([a, b]) => [`print((${a}) // (${b}))`, `print((${a}) % (${b}))`])
  .join('\n');
const c = `#include <stdio.h>\nint main(void) {\n${pairs
  .flatMap(([a, b]) => [
    `printf("%d\\n", (${a}) / (${b}));`,
    `printf("%d\\n", (${a}) % (${b}));`,
  ])
  .join('\n')}\nreturn 0;\n}\n`;
const options = { encoding: 'utf8', maxBuffer: 64 * 1024 };
const folder = mkdtempSync(join(tmpdir(), 'integer-rounding-'));
try {
  const source = join(folder, 'source.c');
  const binary = join(folder, 'source');
  writeFileSync(source, c);
  execFileSync('cc', ['-std=c99', '-O0', source, '-o', binary], options);
  const expected = {
    python: execFileSync('python3', ['-c', python], options),
    c: execFileSync(binary, [], options),
  };
  const translator = createTranslator();
  const results = [];
  for (const [from, to, command, args] of [
    ['python', 'javascript', 'node', ['-e']],
    ['python', 'perl', 'perl', ['-we']],
    ['c', 'python', 'python3', ['-c']],
  ]) {
    const written = translator.translate(from === 'c' ? c : python, from, to);
    const output = execFileSync(command, [...args, written], options);
    const actual = output.trim().split('\n');
    const wanted = expected[from].trim().split('\n');
    const failures = actual.flatMap((value, i) =>
      value === wanted[i]
        ? []
        : [
            {
              pair: pairs[Math.floor(i / 2)],
              operator: i % 2 ? 'remainder' : 'division',
              expected: wanted[i],
              actual: value,
            },
          ]
    );
    results.push({ from, to, cases: wanted.length, failures, written });
  }
  console.log(JSON.stringify({ results }, null, 2));
  process.exitCode = Number(results.some((r) => r.failures.length));
} finally {
  rmSync(folder, { recursive: true, force: true });
}
