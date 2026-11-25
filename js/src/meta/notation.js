// A meta program as indented Links Notation, for people to read: one line
// per node, its kind first, its plain fields as (name value) links and its
// child nodes indented below it under their field name. Fields come in name
// order, as in the Rust format_meta.
//
//   program
//     main: block
//       statements
//         print (newline true)
//           value: binary (operator multiply) (type integer)
//             left: name (name x) (type integer)
//             right: number (type integer) (value 3)

const kebab = (text) =>
  text.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

const plainAtom = /^[\p{L}\p{N}_.+*/<>=!-]+$/u;

function atom(value) {
  const text = String(value);
  return typeof value === 'string' && !plainAtom.test(text)
    ? `'${text.split("'").join("''")}'`
    : text;
}

const isNode = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isScalar = (value) =>
  value === null || ['string', 'number', 'boolean'].includes(typeof value);

// Fields in name order, the kind left out.
const fieldsOf = (node) =>
  Object.entries(node)
    .filter(([field]) => field !== 'kind')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

const isEmpty = (value) =>
  value === undefined ||
  (Array.isArray(value) && value.length === 0) ||
  (isNode(value) && Object.keys(value).length === 0);

function head(node) {
  const parts = node.kind ? [kebab(node.kind)] : [];
  for (const [field, value] of fieldsOf(node)) {
    if (isEmpty(value)) {
      continue;
    }
    if (isScalar(value)) {
      parts.push(`(${field} ${atom(value)})`);
    } else if (Array.isArray(value) && value.every(isScalar)) {
      parts.push(`(${[field, ...value.map(atom)].join(' ')})`);
    }
  }
  return parts.join(' ');
}

function lines(node, indent, label, out) {
  out.push(`${indent}${label ? `${label}: ` : ''}${head(node)}`.trimEnd());
  const inner = `${indent}  `;
  for (const [field, value] of fieldsOf(node)) {
    if (isEmpty(value)) {
      continue;
    }
    if (isNode(value)) {
      lines(value, inner, field, out);
    } else if (Array.isArray(value) && !value.every(isScalar)) {
      out.push(`${inner}${field}`);
      for (const item of value) {
        if (isNode(item)) {
          lines(item, `${inner}  `, '', out);
        } else {
          out.push(`${inner}  ${atom(item)}`);
        }
      }
    }
  }
  return out;
}

// Meta program (or fragment) -> Links Notation text.
export function formatMeta(program) {
  return `${lines(program, '', '', []).join('\n')}\n`;
}
