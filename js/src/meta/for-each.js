// The for-each loop of the meta language: ForEach { variable, array, body }.
// Languages with a for-each syntax write it natively (the `forEach` template
// of their description in formal/languages.js). The others write the counting loop
// over a fresh index whose body starts by reading the element,
//
//   for index in 0..len(a): x = a[index]; ...
//
// and the rule that reads a program raises that loop back to a ForEach, so
// that every language round-trips to the same meta program.

import { block, node, number, rewrite, walk } from './tree.js';

// The names a function body and its parameters already use.
export function usedNames(body, parameters = []) {
  const used = new Set(parameters.map((parameter) => parameter.name));
  walk(body, (current) => {
    for (const key of ['name', 'variable']) {
      if (typeof current[key] === 'string') {
        used.add(current[key]);
      }
    }
  });
  return used;
}

// A name for a loop index that is not in `used`.
export function freshName(used) {
  const candidates = ['index', 'position', 'slot', 'place'];
  return (
    candidates.find((candidate) => !used.has(candidate)) ??
    [2, 3, 4, 5, 6, 7, 8, 9]
      .map((count) => `index-${count}`)
      .find((candidate) => !used.has(candidate))
  );
}

const mentions = (tree, identifier) => {
  let found = false;
  walk(tree, (current) => {
    if (current.kind === 'Name' && current.name === identifier) {
      found = true;
    }
  });
  return found;
};

// Whether a tree assigns or declares the name, or stores into the array of
// that name.
const changes = (tree, identifier) => {
  let found = false;
  walk(tree, (current) => {
    if (
      ['Assignment', 'Declaration', 'IndexAssignment'].includes(current.kind) &&
      current.name === identifier
    ) {
      found = true;
    }
  });
  return found;
};

// A loop that changes its own variable or the array it reads is written as
// a counting loop everywhere: the loop variable is read-only in many
// languages and the array may not change while it is being read.
export const isPlain = (loop) =>
  !changes(loop.body, loop.variable) && !changes(loop.body, loop.array.name);

// The ForEach written out as a counting loop over the index.
function lowered(loop, index, body) {
  const { variable, array } = loop;
  const element = node('Declaration', {
    name: variable,
    type: 'integer',
    value: node('Index', { array, index: node('Name', { name: index }) }),
    mutable: changes(loop.body, variable),
  });
  return node('CountingLoop', {
    variable: index,
    start: number(0),
    end: node('Length', { array, type: 'integer' }),
    body: block([element, ...body.statements]),
  });
}

// Every ForEach the `keep` test refuses becomes a counting loop. The index
// differs from every name of the function and from the index of the loops
// around it.
export function lowerForEach(program, keep) {
  const expand = (tree, used, around) => {
    if (Array.isArray(tree)) {
      return tree.map((item) => expand(item, used, around));
    }
    if (!tree || typeof tree !== 'object' || !tree.kind) {
      return tree;
    }
    if (tree.kind === 'ForEach' && !keep(tree)) {
      const index = freshName(new Set([...used, ...around]));
      return lowered(
        tree,
        index,
        expand(tree.body, used, new Set([...around, index]))
      );
    }
    return Object.fromEntries(
      Object.entries(tree).map(([key, value]) => [
        key,
        value && typeof value === 'object'
          ? expand(value, used, around)
          : value,
      ])
    );
  };
  const inside = (body, parameters = []) =>
    expand(body, usedNames(body, parameters), new Set());
  return {
    ...program,
    functions: program.functions.map((item) => ({
      ...item,
      body: inside(item.body, item.parameters),
    })),
    main: inside(program.main),
  };
}

// `for index in 0..len(a): x = a[index]; ...` where the index is used for
// nothing else is the loop `for x in a`.
function raised(counting) {
  const [first, ...rest] = counting.body.statements;
  const { variable, start, end } = counting;
  const array = end.kind === 'Length' ? end.array : undefined;
  const reads = first?.value;
  if (
    !array ||
    start.kind !== 'Number' ||
    start.value !== 0 ||
    first?.kind !== 'Declaration' ||
    reads?.kind !== 'Index' ||
    reads.array.name !== array.name ||
    reads.index.kind !== 'Name' ||
    reads.index.name !== variable
  ) {
    return undefined;
  }
  const remaining = block(rest);
  return mentions(remaining, variable) || changes(remaining, array.name)
    ? undefined
    : node('ForEach', { variable: first.name, array, body: remaining });
}

export function raiseForEach(program) {
  return rewrite(program, (current) =>
    current.kind === 'CountingLoop' ? (raised(current) ?? current) : current
  );
}
