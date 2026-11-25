// Issue 12: build the demo WITHOUT the readThemeFilesAsWritten workaround of
// its vite.config.js and show what Vite makes of ui-themes'
// new URL(`../themes/${path}`, import.meta.url) (readThemeFile in
// src/mapping.js). Usage: node experiments/issue-12-vite-theme-url.mjs
import { readdirSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const app = new URL('../examples/universal-app/', import.meta.url);
const from = (path) => import(new URL(path, app).href);
const { build } = await from('node_modules/vite/dist/node/index.js');
const { default: react } = await from(
  'node_modules/@vitejs/plugin-react/dist/index.js'
);
const { default: base } = await import(
  pathToFileURL(new URL('vite.config.js', app).pathname).href
);
const outDir = '/tmp/issue-12-vite-theme-url';
await build({
  ...base,
  configFile: false,
  root: app.pathname,
  logLevel: 'warn',
  plugins: [react()],
  build: { outDir, emptyOutDir: true },
});
for (const file of readdirSync(`${outDir}/assets`)) {
  const code = readFileSync(`${outDir}/assets/${file}`, 'utf8');
  const at = code.indexOf('Cannot load theme data');
  if (at !== -1) {
    console.log(file);
    console.log(code.slice(Math.max(0, at - 700), at + 40));
  }
}
