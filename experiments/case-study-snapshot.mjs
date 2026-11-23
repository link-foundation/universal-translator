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

function readSnapshot(source) {
  const records = new Parser().parse(source, { syntax: false });
  assert.equal(records.length, 1);
  const [record] = records;
  assert.equal(record.id, 'snapshot');
  assert.equal(record.values.length, 1);
  return decode(record.values[0]);
}

const decodeMode = process.argv[2] === '--decode';
const input = readFileSync(process.argv[decodeMode ? 3 : 2] ?? 0, 'utf8');
if (decodeMode) {
  process.stdout.write(`${JSON.stringify(readSnapshot(input), null, 2)}\n`);
} else {
  const value = JSON.parse(input);
  const source = formatBinaryDocument([new Link('snapshot', [encode(value)])]);
  assert.deepEqual(readSnapshot(source), value);
  process.stdout.write(`${source}\n`);
}
