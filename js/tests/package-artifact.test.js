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
    const npm = (args, cwd = workspace) =>
      execFileSync('npm', args, {
        cwd,
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
      expect(paths).toContain('data/01-systems.lino');
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
      expect(
        npm(['exec', '--offline', '--', 'universal-translator', '--help'])
      ).toContain('Usage: universal-translator');
      expect(
        npm([
          'exec',
          '--offline',
          '--',
          'universal-translator',
          'add',
          '2',
          '3',
        ]).trim()
      ).toBe('5');
      const input = join(workspace, 'source.py');
      writeFileSync(input, 'print("Hello, World!")\n');
      expect(
        npm([
          'exec',
          '--offline',
          '--',
          'universal-translator',
          'translate',
          'python',
          'javascript',
          input,
        ])
      ).toBe('console.log("Hello, World!");\n');
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
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });
});
