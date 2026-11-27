// One 1.2 MB bundle made Vite warn on every build. Each group below is
// below the 500 kB warning limit and changes on its own schedule, so a
// browser keeps the others cached across releases. A group must not import
// a group that imports it back (Vite warns about a circular chunk): formal
// imports only meta, so both share a chunk that the rest of js/src uses;
// natural imports meta and source records too, so it has a chunk of its own,
// and its generated vocabulary data one more. Source records depend only on
// each other, allowing parsers and writers to share their positions.
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
  [
    'translator-source',
    /[\\/]js[\\/]src[\\/]translation[\\/](comment-syntax|concrete-syntax|source-syntax|source-origins|source-spans|emission-map|layout)\.js$/,
  ],
  ['translator-formal', /[\\/]js[\\/]src[\\/](formal|meta)[\\/]/],
  [
    'natural-vocabulary',
    /[\\/]js[\\/]src[\\/]natural[\\/]sources-vocabulary\.js$/,
  ],
  ['translator-natural', /[\\/]js[\\/]src[\\/]natural[\\/]/],
  ['translator', /[\\/]js[\\/]src[\\/]/],
];

export function chunkFor(id) {
  // The skin data stays in the lazy theme-files chunk.
  if (/theme-files\.js$|ui-themes[\\/]themes[\\/]/.test(id.split('?')[0])) {
    return undefined;
  }
  return chunkGroups.find(([, pattern]) => pattern.test(id))?.[0];
}
