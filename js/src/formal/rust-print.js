import { name, node, text } from '../meta/tree.js';
import { inheritOrigin } from '../translation/source-origins.js';

const identifier = /^(?:[A-Za-z][A-Za-z0-9_]*|_[A-Za-z0-9_]+)$/u;
const literal = new Set(['Text', 'Number', 'Boolean']);
const pieces = /[^{}]+|\{\{|\}\}|\{([^{}]*)\}/gu;
const escapes = new Map([
  ['{{', '{'],
  ['}}', '}'],
]);

export const isRustPrint = (callee) =>
  callee === 'println!' || callee === 'print!';

// Resolve default Display fields. The automatic index advances for empty
// fields only. Explicit named arguments also shadow captured variables.
export function rustPrintParts(format, values, named) {
  const namedIndices = new Map(named.map(({ name }, index) => [name, index]));
  const argumentsInOrder = [...values, ...named.map(({ value }) => value)];
  const parts = [];
  const used = [];
  let captured = false;
  let automatic = 0;
  let end = 0;
  for (const match of format.matchAll(pieces)) {
    if (match.index !== end) {
      return undefined;
    }
    end += match[0].length;
    const field = match[1]?.trimEnd();
    if (field === undefined) {
      parts.push(text(escapes.get(match[0]) ?? match[0]));
      continue;
    }
    const index = fieldIndex(field, automatic, values.length, namedIndices);
    if (field === '') {
      automatic += 1;
    }
    if (index === undefined && identifier.test(field)) {
      captured = true;
      parts.push(name(field));
    } else if (index !== undefined) {
      used.push(index);
      parts.push(argumentsInOrder[index]);
    } else {
      return undefined;
    }
  }
  if (end !== format.length || new Set(used).size !== argumentsInOrder.length) {
    return undefined;
  }
  // Moving or duplicating an expression could change its side effects.
  return argumentsInOrder.every(isSimple) ||
    (!captured && used.every((index, order) => index === order))
    ? parts
    : undefined;
}

// Keep the original native format. Materializing captured variables as named
// arguments lets the same identifier rules apply to their references.
export function nativeRustPrint(call, format, named) {
  const seen = new Set(named.map((argument) => argument.name));
  const captures = [];
  for (const [, field] of format.matchAll(pieces)) {
    const label = field?.split(':', 1)[0].trimEnd();
    if (label && identifier.test(label) && !seen.has(label)) {
      captures.push(node('NamedArgument', { name: label, value: name(label) }));
      seen.add(label);
    }
  }
  return inheritOrigin(
    { ...call, arguments: [...call.arguments, ...captures] },
    call
  );
}

function fieldIndex(field, automatic, count, named) {
  if (field === '' || /^\d+$/u.test(field)) {
    const index = field === '' ? automatic : Number(field);
    return index < count ? index : undefined;
  }
  const index = named.get(field);
  return index === undefined ? undefined : count + index;
}

const isSimple = (value) =>
  literal.has(value.kind) ||
  (value.kind === 'Name' && identifier.test(value.name));
