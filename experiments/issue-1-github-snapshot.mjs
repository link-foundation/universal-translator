import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Link, Parser, formatBinaryDocument } from 'links-notation';

function encode(value) {
  if (value === null) {
    return new Link('null');
  }
  if (Array.isArray(value)) {
    return new Link('array', value.map(encode));
  }
  if (typeof value === 'object') {
    return new Link(
      'object',
      Object.entries(value).map(([key, item]) => new Link(key, [encode(item)]))
    );
  }
  return new Link(typeof value, [new Link(String(value))]);
}

function decode({ id, values }) {
  switch (id) {
    case 'null':
      return null;
    case 'array':
      return values.map(decode);
    case 'object':
      return Object.fromEntries(
        values.map(({ id, values: [value] }) => [id, decode(value)])
      );
    case 'boolean':
      return values[0].id === 'true';
    case 'number':
      return Number(values[0].id);
    case 'string':
      return values[0].id;
    default:
      throw new Error(`Unknown snapshot value ${id}`);
  }
}

const value = JSON.parse(readFileSync(process.argv[2] ?? 0, 'utf8'));
const source = formatBinaryDocument([new Link('snapshot', [encode(value)])]);
const [record] = new Parser().parse(source, { syntax: false });
assert.deepEqual(decode(record.values[0]), value);
process.stdout.write(`${source}\n`);
