import { createLogger, defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const themeReader = 'export async function readThemeFile(path) {';
const themeFiles = fileURLToPath(
  new URL('./src/theme-files.js', import.meta.url)
);

// ui-themes reads its data files with fetch, or with node:fs/promises when
// the page comes from file:// – the packaged desktop app. Vite replaces
// node:fs/promises with an empty module in a browser build, so every skin
// failed there with "readFile is not a function". The reader takes the
// files from src/theme-files.js instead, on every platform.
function bundleThemeFiles() {
  return {
    name: 'bundle-ui-theme-files',
    enforce: 'pre',
    transform(code, id) {
      if (!/ui-themes[\\/]src[\\/]mapping\.js$/.test(id.split('?')[0])) {
        return undefined;
      }
      const start = code.indexOf(themeReader);
      const end = code.indexOf('\n}\n', start);
      if (start === -1 || end === -1) {
        throw new Error(
          `${id}: readThemeFile changed; update bundleThemeFiles`
        );
      }
      return `${code.slice(0, start)}${themeReader}
  const { default: files } = await import(${JSON.stringify(themeFiles)});
  const text = files.get(path);
  if (text === undefined) {
    throw new Error(\`Cannot load theme data: \${path}\`);
  }
  return text;${code.slice(end)}`;
    },
  };
}

// One 1.2 MB bundle made Vite warn on every build. Each group below is
// below the 500 kB warning limit and changes on its own schedule, so a
// browser keeps the others cached across releases. A group must not import
// a group that imports it back (Vite warns about a circular chunk): formal
// imports only meta, so both share a chunk that the rest of js/src uses.
const chunkGroups = [
  ['react', /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/],
  [
    'ui-components',
    /[\\/]node_modules[\\/](@link-foundation[\\/]ui-components|@floating-ui)[\\/]/,
  ],
  [
    'ui',
    /[\\/]node_modules[\\/](@link-foundation[\\/]ui-[^\\/]+|@material)[\\/]/,
  ],
  ['links-notation', /[\\/]node_modules[\\/](links-notation|lino-i18n)[\\/]/],
  ['translator-formal', /[\\/]js[\\/]src[\\/](formal|meta)[\\/]/],
  ['translator', /[\\/]js[\\/]src[\\/]/],
];

export function chunkFor(id) {
  // The skin data stays in the lazy theme-files chunk.
  if (/theme-files\.js$|ui-themes[\\/]themes[\\/]/.test(id.split('?')[0])) {
    return undefined;
  }
  return chunkGroups.find(([, pattern]) => pattern.test(id))?.[0];
}

// A build warning used to scroll past in every CI log (the empty
// node:fs/promises above, then the chunk size). Record every warning, Vite's
// own and Rollup's, and fail the build after the bundle is written, so the
// log still shows all of them. VITE_ALLOW_WARNINGS=true keeps them warnings.
const logger = createLogger();
const warnings = [];
for (const method of ['warn', 'warnOnce']) {
  const print = logger[method].bind(logger);
  logger[method] = (message, options) => {
    warnings.push(message);
    print(message, options);
  };
}

function failOnWarnings() {
  return {
    name: 'fail-on-build-warnings',
    apply: 'build',
    buildStart() {
      warnings.length = 0;
    },
    closeBundle() {
      if (warnings.length && process.env.VITE_ALLOW_WARNINGS !== 'true') {
        throw new Error(
          `The build printed ${warnings.length} warning(s); see the log above`
        );
      }
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
  customLogger: logger,
  plugins: [react(), bundleThemeFiles(), failOnWarnings()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: { manualChunks: chunkFor },
    },
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
