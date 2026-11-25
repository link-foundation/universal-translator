// The size limit of the web build's chunks, checked by vite.config.js.
// Vite's limit of a chunk (500 kB minified) holds for every chunk but
// Monaco's own: its editor core is one 1.5 MB chunk that cannot be split
// (its layers import each other, and the base layer alone is 840 kB) and
// that loads only when the Monaco editor is chosen in the settings. So
// Vite's own warning is raised above Monaco's size, and this check keeps
// the 500 kB limit for every chunk with a module from outside Monaco.

export const chunkLimit = 500 * 1024;

const monacoModule = /[\\/]node_modules[\\/]monaco-editor[\\/]/;

// The chunks of a Rollup bundle above the limit, as "file (size kB)".
export function oversizedChunks(bundle) {
  return Object.values(bundle)
    .filter(
      ({ type, code, moduleIds = [] }) =>
        type === 'chunk' &&
        code.length > chunkLimit &&
        !moduleIds.every((id) => monacoModule.test(id))
    )
    .map(
      ({ fileName, code }) =>
        `${fileName} (${Math.round(code.length / 1024)} kB)`
    );
}
