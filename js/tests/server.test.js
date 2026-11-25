import { describe, expect, it } from 'test-anywhere';

import { createTranslationServer, translate } from '../../js/src/index.js';
import { runCli } from '../../bin/universal-translator.js';

async function withServer(check) {
  const server = createTranslationServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await check(base);
  } finally {
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

  it('is started by the serve command', () => {
    const ports = [];
    const quiet = () => {};
    expect(runCli(['serve'], { serve: (port) => ports.push(port) })).toBe(0);
    expect(
      runCli(['serve', '--port', '9090'], {
        serve: (port) => ports.push(port),
      })
    ).toBe(0);
    expect(ports).toEqual([8080, 9090]);
    expect(runCli(['serve', '--port', 'x'], { stderr: quiet })).toBe(1);
  });
});
