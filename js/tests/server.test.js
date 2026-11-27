import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'test-anywhere';

import { createTranslationServer, translate } from '../../js/src/index.js';
import { runCli, serveConfiguration } from '../../bin/universal-translator.js';

async function withServer(check) {
  const server = createTranslationServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await check(base);
  } finally {
    // Deno's fetch keeps connections alive and its server.close() waits for
    // them, so drop them first (experiments/deno-server-close.mjs).
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

const post = (base, body) =>
  fetch(`${base}/translate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

describe('translation server', () => {
  it('lists programming and natural languages', async () => {
    await withServer(async (base) => {
      const response = await fetch(`${base}/languages`);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.languages.map(({ id }) => id)).toContain('python');
      expect(body.naturalLanguages.map(({ id }) => id)).toContain('english');
    });
  });

  it('translates like the library does', async () => {
    const source = 'console.log("Hi");\n';
    await withServer(async (base) => {
      const response = await post(base, {
        source,
        from: 'javascript',
        to: 'python',
      });
      expect(response.status).toBe(200);
      expect((await response.json()).output).toBe(
        translate(source, 'javascript', 'python')
      );
    });
  });

  it('keeps the layout of the source and maps the lines', async () => {
    const source = '\nconsole.log( "Hi");\n';
    await withServer(async (base) => {
      const kept = await (
        await post(base, { source, from: 'javascript', to: 'python' })
      ).json();
      expect(kept.output).toBe('\nprint( "Hi")\n');
      expect(kept.lineMap).toEqual([[1, 1]]);
      const written = await (
        await post(base, {
          source,
          from: 'javascript',
          to: 'python',
          layout: 'target',
        })
      ).json();
      expect(written.output).toBe('print("Hi")\n');
      const wrong = await post(base, {
        source,
        from: 'javascript',
        to: 'python',
        layout: 'both',
      });
      expect((await wrong.json()).error).toBe(
        '"layout" must be one of source, target'
      );
    });
  });

  it('writes the braces and the indent asked for', async () => {
    const source = 'if (a) {\n  f();\n}\n';
    await withServer(async (base) => {
      const styled = await (
        await post(base, {
          source,
          from: 'javascript',
          to: 'java',
          braces: 'next-line',
          indent: 2,
        })
      ).json();
      expect(styled.output).toContain('    if (a)\n    {\n      f();\n    }');
      const wrong = await post(base, {
        source,
        from: 'javascript',
        to: 'java',
        indent: 'wide',
      });
      expect((await wrong.json()).error).toBe(
        'Unsupported indent "wide": a number of spaces from 1 to 16 or "tab"'
      );
    });
  });

  it('returns semantic maps for prose, controlled words and instructions', async () => {
    await withServer(async (base) => {
      for (const [source, from, to] of [
        ['I see the world.', 'english', 'russian'],
        ['console.log(1);\n', 'javascript', 'russian'],
        ['Print 1.\n', 'english', 'python'],
        ['console.log(1);\n', 'javascript', 'nasm'],
        ['console.log(1);\n', 'javascript', 'wat'],
      ]) {
        const response = await post(base, { source, from, to });
        expect(response.status).toBe(200);
        const result = await response.json();
        expect(result.complete).toBe(true);
        expect(result.lineMap.length > 0).toBe(true);
        const lines = result.output.split('\n');
        expect(
          result.lineMap.every(([from, to]) => from === 0 && lines[to].trim())
        ).toBe(true);
      }
    });
  });

  it('translates only the comments to a comment language', async () => {
    await withServer(async (base) => {
      const response = await post(base, {
        source: '// number\nlet x = 1;\n',
        from: 'javascript',
        to: 'javascript',
        commentLanguage: 'russian',
      });
      expect((await response.json()).output).toBe('// число\nlet x = 1;\n');
      const wrong = await post(base, {
        source: '',
        from: 'javascript',
        to: 'python',
        commentLanguage: 1,
      });
      expect((await wrong.json()).error).toBe(
        '"commentLanguage" must be a string'
      );
    });
  });

  it('rejects invalid requests with a message', async () => {
    await withServer(async (base) => {
      const broken = await post(base, '{');
      expect(broken.status).toBe(400);
      expect((await broken.json()).error).toContain('not JSON');
      const missing = await post(base, { source: 'x', from: 'javascript' });
      expect((await missing.json()).error).toBe('"to" must be a string');
      const mode = await post(base, {
        source: '',
        from: 'javascript',
        to: 'python',
        mode: 'loose',
      });
      expect((await mode.json()).error).toContain('"mode" must be one of');
      const unknown = await fetch(`${base}/nowhere`);
      expect(unknown.status).toBe(404);
    });
  });
});

describe('serve command', () => {
  it('is started by the serve command', () => {
    const started = [];
    const quiet = () => {};
    const serve = (configuration) => started.push(configuration.port);
    expect(runCli(['serve'], { serve })).toBe(0);
    expect(runCli(['serve', '--port', '9090'], { serve })).toBe(0);
    expect(started[1]).toBe(9090);
    expect(runCli(['serve', '--port', 'x'], { stderr: quiet })).toBe(1);
    expect(runCli(['serve', '--bogus'], { stderr: quiet })).toBe(1);
  });

  it('reads its port from options, the environment and .lenv', () => {
    const empty = { env: {}, cwd: tmpdir() };
    expect(serveConfiguration([], empty)).toEqual({
      port: 8080,
      host: '0.0.0.0',
    });
    expect(serveConfiguration([], { ...empty, env: { PORT: '9000' } })).toEqual(
      { port: 9000, host: '0.0.0.0' }
    );
    expect(
      serveConfiguration(['--port', '7000', '--host', '127.0.0.1'], {
        ...empty,
        env: { PORT: '9000' },
      })
    ).toEqual({ port: 7000, host: '127.0.0.1' });
    const directory = mkdtempSync(join(tmpdir(), 'serve-'));
    writeFileSync(join(directory, '.lenv'), 'PORT: 6000\n');
    expect(serveConfiguration([], { env: {}, cwd: directory }).port).toBe(6000);
    rmSync(directory, { recursive: true });
  });
});
