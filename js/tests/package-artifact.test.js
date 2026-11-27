import { describe, expect } from 'test-anywhere';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { itUnless, sandboxed } from './helpers/skip.js';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

describe('published package artifact', () => {
  itUnless(
    sandboxed,
    process.platform === 'win32' && 'npm.cmd requires a shell on Windows'
  )('packs and installs the renamed package with a working npx command', () => {
    const workspace = mkdtempSync(join(tmpdir(), 'translator-artifact-'));
    const env = { ...process.env, UNIVERSAL_TRANSLATOR_META_LANGUAGE: '' };
    const npm = (args, cwd = workspace) =>
      execFileSync('npm', args, {
        cwd,
        env,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });

    try {
      const [artifact] = JSON.parse(
        npm(
          [
            'pack',
            '--json',
            '--ignore-scripts',
            '--pack-destination',
            workspace,
          ],
          resolve('.')
        )
      );
      expect(artifact.name).toBe('@link-foundation/universal-translator');
      expect(artifact.filename).toBe(
        `link-foundation-universal-translator-${packageJson.version}.tgz`
      );
      const paths = artifact.files.map((file) => file.path);
      expect(paths).toContain('bin/universal-translator.js');
      expect(paths).toContain('js/src/index.js');
      expect(paths).toContain('js/src/translator.js');
      expect(paths).toContain('vendor/meta-language-grammar/src/grammar.js');
      expect(paths).toContain('vendor/meta-language-grammar/LICENSE');
      expect(paths).toContain(
        'vendor/meta-language-grammar/src/vendor/grammars/python.wasm.gz'
      );
      expect(paths).toContain(
        'vendor/meta-language-grammar/src/vendor/grammars/python.LICENSE'
      );
      expect(paths).toContain(
        'vendor/meta-language-grammar/src/data/native-grammars/rust.lino'
      );
      expect(paths.some((path) => path.startsWith('js/tests/'))).toBe(false);
      expect(paths.filter((path) => path.startsWith('bin/'))).toEqual([
        'bin/universal-translator.js',
      ]);

      writeFileSync(
        join(workspace, 'package.json'),
        JSON.stringify({ private: true, type: 'module' })
      );
      npm([
        'install',
        join(workspace, artifact.filename),
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        '--package-lock=false',
      ]);
      expect(
        npm([
          'exec',
          '--offline',
          '--',
          'universal-translator',
          '--version',
        ]).trim()
      ).toBe(packageJson.version);
      const bin = join(
        workspace,
        'node_modules',
        '.bin',
        'universal-translator'
      );
      const cli = (...args) =>
        execFileSync(bin, args, { cwd: workspace, env, encoding: 'utf8' });
      expect(cli('--help')).toContain('Usage: universal-translator');
      expect(cli('add', '2', '3').trim()).toBe('5');
      const input = join(workspace, 'source.py');
      writeFileSync(input, 'print("Hello, World!")\n');
      expect(cli('translate', 'python', 'javascript', input)).toBe(
        'console.log("Hello, World!");\n'
      );
      const encoded = join(workspace, 'source.lino');
      writeFileSync(encoded, cli('encode-cst', 'Python', input));
      expect(cli('decode-cst', encoded)).toBe('print("Hello, World!")\n');
      const program = join(workspace, 'main.js');
      writeFileSync(program, 'const answer = 6 * 7;\nconsole.log(answer);\n');
      const rust = cli('translate-program', 'javascript', 'rust', program);
      expect(rust).toContain('fn main()');
      expect(rust).toContain('println!');
      const lean = join(workspace, 'Main.lean');
      writeFileSync(lean, 'def main : IO Unit := do\n  IO.println "Hello"\n');
      writeFileSync(encoded, cli('encode-cst', 'Lean', lean));
      const fromLean = cli('translate-program', 'cst', 'javascript', encoded);
      expect(fromLean).toContain('console.log("Hello")');
      expect(
        execFileSync(
          process.execPath,
          [
            ...(globalThis.Deno ? ['eval'] : ['--input-type=module', '-e']),
            "import { multiply } from '@link-foundation/universal-translator'; console.log(multiply(6, 7));",
          ],
          { cwd: workspace, encoding: 'utf8' }
        ).trim()
      ).toBe('42');
      expect(
        execFileSync(
          process.execPath,
          [
            ...(globalThis.Deno ? ['eval'] : ['--input-type=module', '-e']),
            "import { createGrammarWorkspace, reconstructConcrete } from '@link-foundation/universal-translator/grammar'; const workspace = createGrammarWorkspace(); workspace.import({ id: 'greeting', language: 'english', format: 'ebnf', source: 'start = \"hello\";' }); const result = workspace.parse('hello', { sourceId: 'greeting' }); console.log(reconstructConcrete(result.syntax));",
          ],
          { cwd: workspace, encoding: 'utf8' }
        ).trim()
      ).toBe('hello');
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });
});
