// Identifier naming. The meta language stores each name the program declares
// as neutral lower-case words joined by "-" (for example
// "greatest-common-divisor"); every language description states how it
// spells such words. Names the program does not declare (library procedures)
// are left exactly as written.

import { rewrite } from './meta.js';

// "greatestCommonDivisor", "greatest_common_divisor" and
// "GreatestCommonDivisor" all become ["greatest", "common", "divisor"].
export function nameWords(identifier) {
  return identifier
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase());
}

const capitalize = (word) => word.charAt(0).toUpperCase() + word.slice(1);

export const conventions = {
  camel: (words) =>
    words
      .map((word, index) => (index === 0 ? word : capitalize(word)))
      .join(''),
  pascal: (words) => words.map(capitalize).join(''),
  snake: (words) => words.join('_'),
};

export function neutralName(identifier) {
  return nameWords(identifier).join('-');
}

export function spellName(neutral, convention) {
  const spell = conventions[convention];
  if (!spell) {
    throw new Error(`Unknown naming convention "${convention}"`);
  }
  return spell(neutral.split('-'));
}

// Every name the program itself introduces.
export function declaredNames(program) {
  const names = new Set();
  for (const item of program.functions) {
    names.add(item.name);
    item.parameters.forEach((parameter) => names.add(parameter.name));
  }
  rewrite(program, (current) => {
    if (current.kind === 'Declaration') {
      names.add(current.name);
    }
    if (current.kind === 'CountingLoop') {
      names.add(current.variable);
    }
    return current;
  });
  return names;
}

// Apply `rename(name, role)` to every declared name; role is "function" or
// "variable" so languages such as C# can spell methods differently.
export function renameDeclared(program, rename) {
  const declared = declaredNames(program);
  const functionNames = new Set(program.functions.map((item) => item.name));
  const change = (identifier) => {
    if (!declared.has(identifier)) {
      return identifier;
    }
    return rename(
      identifier,
      functionNames.has(identifier) ? 'function' : 'variable'
    );
  };
  const renamed = rewrite(program, (current) => {
    switch (current.kind) {
      case 'Name':
        return { ...current, name: change(current.name) };
      case 'Call':
        return { ...current, callee: change(current.callee) };
      case 'Declaration':
      case 'Assignment':
        return { ...current, name: change(current.name) };
      case 'CountingLoop':
        return { ...current, variable: change(current.variable) };
      default:
        return current;
    }
  });
  return {
    ...renamed,
    functions: renamed.functions.map((item) => ({
      ...item,
      name: change(item.name),
      parameters: item.parameters.map((parameter) => ({
        ...parameter,
        name: change(parameter.name),
      })),
    })),
  };
}
