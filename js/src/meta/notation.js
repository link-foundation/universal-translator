// A meta program as indented Links Notation, for people to read. Every node
// is one line: its kind, its main value as a plain word and its other plain
// fields as (name value) links. Every child field is named, so conditions,
// actions, operands and arguments remain distinguishable at every depth.
//
//   program (comments hi)
//     main
//       declaration x (mutable false) (type text)
//         value
//           text 'a b' (type text)
//       evaluate
//         expression
//           call print-line (library standard)
//             arguments
//               name x (type text)
//
// The program is written in its general form (see library.js): writing a
// line or taking a length is a call to a procedure of the standard
// library, like any other call.
//
// A block is written under its field name (main, body, then, otherwise).
// Evaluate remains a statement containing an expression: a call used for
// its effect cannot be confused with a call used as a value.
// Links Notation keeps "name:" for links that define a unique name, and no
// field name is unique here: "value", "left" or "body" appear again and
// again. The Rust format_meta writes the same text.

import { generalize } from './library.js';

const kebab = (text) =>
  text.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

const plainAtom = /^[\p{L}\p{N}_.+*/<>=!-]+$/u;

function atom(value) {
  const text = String(value);
  return typeof value === 'string' && !plainAtom.test(text)
    ? `'${text.split("'").join("''")}'`
    : text;
}

// The field written as a plain word right after the kind.
const mainField = {
  Assignment: 'name',
  Binary: 'operator',
  Blank: 'lines',
  Boolean: 'value',
  Call: 'callee',
  Comment: 'text',
  Code: 'language',
  CountingLoop: 'variable',
  Declaration: 'name',
  ForEach: 'variable',
  Function: 'name',
  IndexAssignment: 'name',
  Name: 'name',
  Number: 'value',
  Paragraph: 'id',
  Parameter: 'name',
  Prose: 'language',
  Text: 'value',
  Unary: 'operator',
  Word: 'text',
  '': 'name',
};

// The order in which child nodes are read; other fields follow by name.
const childOrder = [
  'comments',
  'condition',
  'array',
  'index',
  'left',
  'operand',
  'right',
  'start',
  'end',
  'step',
  'length',
  'fill',
  'expression',
  'value',
  'arguments',
  'elements',
  'parts',
  'parameters',
  'texts',
  'functions',
  'statements',
  'then',
  'body',
  'mainComments',
  'main',
  'otherwise',
];

const isNode = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isScalar = (value) =>
  ['string', 'number', 'boolean'].includes(typeof value);

const isEmpty = (value) =>
  value === undefined ||
  value === null ||
  (Array.isArray(value) && value.length === 0) ||
  (isNode(value) && Object.keys(value).length === 0);

const isBlock = (value) => isNode(value) && value.kind === 'Block';

const byName = ([a], [b]) => (a < b ? -1 : a > b ? 1 : 0);

const rank = (field) =>
  childOrder.includes(field) ? childOrder.indexOf(field) : childOrder.length;

const fieldsOf = (node) =>
  Object.entries(node)
    .filter(([field, value]) => field !== 'kind' && !isEmpty(value))
    .sort(byName);

// Fields holding nodes, in reading order.
const childFields = (node) =>
  fieldsOf(node)
    .filter(([, value]) => !isScalar(value) && !value.every?.(isScalar))
    .sort((a, b) => rank(a[0]) - rank(b[0]) || byName(a, b));

// A node without a kind (a parameter) is named after its list: "parameter".
const kindOf = (node, list) =>
  node.kind ? kebab(node.kind) : list ? kebab(list).replace(/s$/u, '') : '';

function head(node, list) {
  const main = mainField[node.kind ?? ''];
  const parts = [kindOf(node, list)];
  if (main && isScalar(node[main])) {
    parts.push(atom(node[main]));
  }
  for (const [field, value] of fieldsOf(node)) {
    if (field === main && isScalar(value)) {
      continue;
    }
    if (isScalar(value)) {
      parts.push(`(${kebab(field)} ${atom(value)})`);
    } else if (Array.isArray(value) && value.every(isScalar)) {
      parts.push(`(${[kebab(field), ...value.map(atom)].join(' ')})`);
    }
  }
  return parts.filter(Boolean).join(' ');
}

function children(value, field, indent, out) {
  const items = isBlock(value) ? (value.statements ?? []) : [value].flat();
  for (const item of items) {
    if (isNode(item)) {
      lines(item, indent, field, out);
    } else {
      out.push(`${indent}${atom(item)}`);
    }
  }
}

function lines(node, indent, list, out) {
  out.push(`${indent}${head(node, list)}`);
  const inner = `${indent}  `;
  for (const [field, value] of childFields(node)) {
    out.push(`${inner}${kebab(field)}`);
    children(value, field, `${inner}  `, out);
  }
  return out;
}

// Meta program (or fragment) -> Links Notation text.
export function formatMeta(program) {
  return `${lines(generalize(program), '', '', []).join('\n')}\n`;
}
