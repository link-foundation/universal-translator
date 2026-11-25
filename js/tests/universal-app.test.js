import { describe, it, expect } from 'test-anywhere';
import { existsSync, readFileSync } from 'node:fs';

const exampleRoot = 'examples/universal-app';
const packageJsonPath = `${exampleRoot}/package.json`;
const appSourcePath = `${exampleRoot}/src/App.js`;
const viteConfigPath = `${exampleRoot}/vite.config.js`;
const capacitorConfigPath = `${exampleRoot}/capacitor.config.json`;
const workflowPath = '.github/workflows/example-app.yml';
const docsPath = `${exampleRoot}/README.md`;

function readText(filePath) {
  return readFileSync(filePath, 'utf8').replaceAll('\r\n', '\n');
}

function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

describe('universal React example app', () => {
  it('defines the expected app package and build targets', () => {
    expect(existsSync(packageJsonPath)).toBe(true);

    const packageJson = readJson(packageJsonPath);

    expect(packageJson.private).toBe(true);
    expect(packageJson.type).toBe('module');
    expect(packageJson.main).toBe('electron/main.cjs');
    expect(Boolean(packageJson.dependencies.react)).toBe(true);
    expect(Boolean(packageJson.dependencies['react-dom'])).toBe(true);
    expect(Boolean(packageJson.dependencies['@capacitor/core'])).toBe(true);
    expect(Boolean(packageJson.devDependencies.vite)).toBe(true);
    expect(Boolean(packageJson.devDependencies.electron)).toBe(true);
    expect(Boolean(packageJson.devDependencies['electron-builder'])).toBe(true);
    expect(Boolean(packageJson.devDependencies['@capacitor/cli'])).toBe(true);

    expect(packageJson.scripts.build).toBe('vite build');
    expect(packageJson.scripts['desktop:package']).toContain(
      'electron-builder --dir'
    );
    expect(packageJson.scripts['mobile:sync']).toContain('cap sync');
    expect(packageJson.scripts['mobile:android:build']).toContain(
      'cap build android'
    );
    expect(packageJson.scripts['mobile:ios:run']).toContain('cap run ios');
  });

  it('renders the translator with every language and fragments', () => {
    const appSource = readText(appSourcePath);
    const workflow = readText(workflowPath);

    expect(appSource).toContain("from '../../../js/src/translator.js'");
    expect(readText(`${exampleRoot}/src/languages.js`)).toContain(
      'translator.languages()'
    );
    expect(readText(`${exampleRoot}/src/languages.js`)).toContain(
      'baseNaturalLanguageIds()'
    );
    expect(appSource).toContain('languageEntries(translator)');
    expect(appSource).toContain('current.translateFragment');
    expect(appSource).toContain("role: 'alert'");
    // Auto-detection, partial translation and the rules editor.
    expect(appSource).toContain("from: 'auto'");
    expect(appSource).toContain('translatePartial');
    expect(appSource).toContain("id: 'all-or-nothing'");
    expect(appSource).toContain('h(RulesEditor');
    expect(workflow).toContain('web-e2e:');
    expect(workflow).toContain('examples/universal-app/e2e/translate.e2e.mjs');
    expect(workflow).toContain(
      'examples/universal-app/e2e/file-protocol.e2e.mjs'
    );
  });

  it('bundles skin data and fails the build on any warning', () => {
    const viteConfig = readText(viteConfigPath);
    // node:fs/promises is an empty module in the browser build, which broke
    // every skin of the desktop app (file://).
    expect(viteConfig).toContain('bundleThemeFiles()');
    expect(readText(`${exampleRoot}/src/theme-files.js`)).toContain(
      'import.meta.glob('
    );
    expect(viteConfig).toContain('failOnWarnings()');
    expect(viteConfig).toContain('customLogger: logger');
    expect(viteConfig).toContain('manualChunks: chunkFor');
    // Vite's chunk limit is raised above Monaco's editor core only;
    // limitChunkSizes keeps 500 kB for every other chunk.
    expect(viteConfig).toContain('limitChunkSizes()');
  });

  it('shares the Vite build output with Capacitor and GitHub Pages', () => {
    const viteConfig = readText(viteConfigPath);
    const capacitorConfig = readJson(capacitorConfigPath);

    expect(viteConfig).toContain('GITHUB_PAGES');
    expect(viteConfig).toContain('base: resolveBasePath()');
    expect(viteConfig).toContain("outDir: 'dist'");
    expect(capacitorConfig.webDir).toBe('dist');
    expect(capacitorConfig.appId).toBe('foundation.link.template.example');
  });

  it('adds root scripts and a workflow for web, desktop, and mobile checks', () => {
    const rootPackageJson = readJson('package.json');
    const workflow = readText(workflowPath);

    expect(rootPackageJson.scripts['example:web:build']).toBe(
      'npm --prefix examples/universal-app run build'
    );
    expect(rootPackageJson.scripts['example:desktop:package']).toBe(
      'npm --prefix examples/universal-app run desktop:package'
    );
    expect(rootPackageJson.scripts['example:mobile:sync']).toBe(
      'npm --prefix examples/universal-app run mobile:sync'
    );

    expect(workflow).toContain(
      'npm ci --prefix examples/universal-app --no-audit --no-fund'
    );
    expect(workflow).toContain('npm run example:web:build');
    expect(workflow).toContain('npm run example:desktop:package');
    expect(workflow).toContain('actions/configure-pages@v6');
    expect(workflow).toContain('actions/upload-pages-artifact');
    expect(workflow).toContain('actions/deploy-pages');
    expect(workflow).toContain('EXAMPLE_APP_ENABLE_ANDROID_BUILD');
    expect(workflow).not.toContain('EXAMPLE_APP_ENABLE_IOS_BUILD');
  });

  it('documents local validation without store credentials', () => {
    const docs = readText(docsPath);

    expect(docs).toContain('npm install --prefix examples/universal-app');
    expect(docs).toContain('npm run example:web:build');
    expect(docs).toContain('npm run example:desktop:package');
    expect(docs).toContain('npm run example:mobile:sync');
    expect(docs).toContain('Apple Developer Program');
    expect(docs).toContain('Google Play Console');
  });

  it('regenerates preview screenshots with browser-commander on every push to main', () => {
    const rootPackageJson = readJson('package.json');
    const workflow = readText(workflowPath);
    const script = readText('scripts/update-preview-images.mjs');
    const rootReadme = readText('README.md');

    expect(rootPackageJson.scripts['example:web:preview-images']).toBe(
      'node scripts/update-preview-images.mjs'
    );
    expect(existsSync('scripts/update-preview-images.mjs')).toBe(true);

    expect(workflow).toContain('preview-regen:');
    // Pinned by digest; the tag lives in the trailing comment.
    expect(workflow).toMatch(
      /image: mcr\.microsoft\.com\/playwright@sha256:[0-9a-f]{64} # v1\.59\.1-noble/
    );
    expect(workflow).toContain('browser-commander');
    expect(workflow).not.toContain('npx playwright install');
    expect(workflow).toContain('node scripts/update-preview-images.mjs');
    expect(workflow).toContain(
      'git commit -m "chore(preview): regenerate example-app preview images"'
    );
    expect(workflow).not.toContain(
      'git commit -m "chore(preview): regenerate example-app preview images [skip ci]"'
    );

    expect(script).toContain("from 'browser-commander'");
    expect(script).toContain("from 'playwright'");
    expect(script).toContain('docs/screenshots/example-app');

    expect(rootReadme).toContain('Auto-regenerated preview screenshots');
    expect(rootReadme).toContain('npm run example:web:preview-images');
  });

  // The preview job runs only on main; a selector from another app (the
  // template's #calculator-title) timed out there after every merge.
  it('waits for preview selectors that the app renders', () => {
    const script = readText('scripts/update-preview-images.mjs');
    const listed = script.match(/const READY_SELECTORS = \[([^\]]*)\]/);
    expect(Boolean(listed)).toBe(true);
    const selectors = [...listed[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(selectors.length > 0).toBe(true);
    const app = readText(appSourcePath);
    for (const selector of selectors) {
      const name = selector.slice(1);
      const rendered = selector.startsWith('#')
        ? app.includes(`id: '${name}'`)
        : app.includes(`className: '${name}'`);
      expect(`${selector} ${rendered}`).toBe(`${selector} true`);
    }
    expect(script).not.toContain('calculator');
  });
});

describe('the web build of the example app', () => {
  it('keeps every chunk but Monaco below 500 kB', async () => {
    const { chunkLimit, oversizedChunks } = await import(
      `../../${exampleRoot}/chunk-limits.js`
    );
    const chunk = (fileName, size, moduleIds) => ({
      type: 'chunk',
      fileName,
      code: 'x'.repeat(size),
      moduleIds,
    });
    const monaco =
      '/app/node_modules/monaco-editor/esm/vs/editor/editor.api.js';
    const bundle = {
      editor: chunk('editor.js', 3 * chunkLimit, [monaco]),
      app: chunk('app.js', chunkLimit + 1, ['/app/src/App.js']),
      mixed: chunk('mixed.js', chunkLimit + 1, [monaco, '/app/src/monaco.js']),
      small: chunk('small.js', chunkLimit, ['/app/src/main.js']),
      style: { type: 'asset', fileName: 'big.css', source: 'x' },
    };
    expect(oversizedChunks(bundle)).toEqual([
      'app.js (500 kB)',
      'mixed.js (500 kB)',
    ]);
  });
});
