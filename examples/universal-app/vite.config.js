import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cpSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// ui-themes fetches its theme files from new URL('../themes/…',
// import.meta.url): next to the bundle in assets/, that is dist/themes.
function copyThemeData() {
  return {
    name: 'copy-ui-theme-data',
    apply: 'build',
    writeBundle(options) {
      cpSync(
        fileURLToPath(
          new URL(
            './node_modules/@link-foundation/ui-themes/themes',
            import.meta.url
          )
        ),
        `${options.dir}/themes`,
        { recursive: true }
      );
    },
  };
}

// Vite turns new URL(`../themes/${path}`, import.meta.url) into a lookup
// of the files one directory down, and the classic themes sit deeper
// (classic/konard/glass.lino): the lookup gives "undefined". The same URL
// built from a plain string concatenation is left as it is.
function readThemeFilesAsWritten() {
  return {
    name: 'read-ui-theme-files-as-written',
    enforce: 'pre',
    transform(code, id) {
      if (!/ui-themes[\\/]src[\\/]mapping\.js$/.test(id.split('?')[0])) {
        return undefined;
      }
      return code.replace(
        'new URL(`../themes/${path}`, import.meta.url)',
        "new URL('../themes/' + path, import.meta.url)"
      );
    },
  };
}

function resolveBasePath() {
  if (process.env.GITHUB_PAGES !== 'true') {
    return './';
  }

  const repository = process.env.GITHUB_REPOSITORY?.split('/').at(-1);
  return repository ? `/${repository}/` : './';
}

export default defineConfig({
  base: resolveBasePath(),
  plugins: [react(), readThemeFilesAsWritten(), copyThemeData()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  // The ui packages read their data (themes, catalogs) next to their
  // modules with new URL(…, import.meta.url): they are served as they are.
  optimizeDeps: {
    exclude: [
      '@link-foundation/ui-themes',
      '@link-foundation/ui-i18n',
      '@link-foundation/ui-tokens',
    ],
  },
  server: {
    fs: {
      allow: ['../..'],
    },
  },
});
