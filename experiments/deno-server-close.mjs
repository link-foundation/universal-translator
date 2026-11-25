// Measures how long server.close() takes after keep-alive fetches, with and
// without closeAllConnections(). Run with: deno run -A experiments/deno-server-close.mjs
import { createTranslationServer } from '../js/src/index.js';

async function trial(closeAll) {
  const server = createTranslationServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (let i = 0; i < 2; i += 1) {
    const response = await fetch(`${base}/translate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        source: '// number\nlet x = 1;\n',
        from: 'javascript',
        to: 'javascript',
        commentLanguage: 'russian',
      }),
    });
    await response.json();
  }
  const started = Date.now();
  if (closeAll) {
    server.closeAllConnections?.();
  }
  const closed = new Promise((resolve) => server.close(resolve));
  const result = await Promise.race([
    closed.then(() => 'closed'),
    new Promise((r) => setTimeout(() => r('still open after 10s'), 10000)),
  ]);
  console.log(
    `closeAllConnections=${closeAll}: ${result} in ${Date.now() - started} ms, closeAllConnections exists: ${typeof server.closeAllConnections}`
  );
}

await trial(false);
await trial(true);
globalThis.Deno?.exit?.(0);
