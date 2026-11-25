// Every ui-themes data file, bundled into one chunk that is loaded with the
// first skin. ui-themes reads these files at run time next to its modules:
// with fetch over http(s), and with node:fs/promises on file://. The desktop
// app opens dist/index.html from file://, where the browser build has no
// node:fs/promises, so vite.config.js points the reader at this module.
const prefix = '../node_modules/@link-foundation/ui-themes/themes/';
const files = import.meta.glob(
  '../node_modules/@link-foundation/ui-themes/themes/**/*.lino',
  { query: '?raw', import: 'default', eager: true }
);

export default new Map(
  Object.entries(files).map(([path, text]) => [path.slice(prefix.length), text])
);
