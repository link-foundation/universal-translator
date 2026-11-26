// Helpers shared by the machine code writers (machine.js and the dialect
// modules next to it).

// Whether a lowered program creates arrays, and so needs the helper that
// allocates and fills them.
export const createsArrays = (program) =>
  [...program.functions, program.main].some((item) =>
    item.code.some(([operation]) => operation === 'new-array')
  );

// Comment lines in a target's comment syntax.
export const comments = (prefix, texts, indent = '') =>
  texts.flatMap((text) =>
    text.split('\n').map((line) => `${indent}${prefix} ${line}`.trimEnd())
  );

// Every function of a lowered program, with "main" last.
export const allFunctions = (program) => [...program.functions, program.main];

// Whether each function returns a value, by name.
export const returnsByName = (program) =>
  new Map(program.functions.map((item) => [item.name, item.returns]));

// The names of the labels of a function in the order they appear.
export const labelNames = (item) =>
  item.code
    .filter(([operation]) => operation === 'label')
    .map(([, name]) => name);

// Bytes of a text as UTF-8.
export const utf8 = (text) => [...new globalThis.TextEncoder().encode(text)];

// A byte is printable when it is ASCII other than a quote or a backslash.
export const printable = (byte) =>
  byte >= 0x20 && byte < 0x7f && byte !== 0x22 && byte !== 0x5c;

export const hex = (byte, width = 2) =>
  byte.toString(16).toUpperCase().padStart(width, '0');
