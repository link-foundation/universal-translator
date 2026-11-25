import { Link, Parser, formatBinaryDocument } from 'links-notation';

export function parseLinks(source) {
  return new Parser().parse(source, { syntax: false });
}

export function linkFields(values) {
  const fields = new Map();
  for (const { id, values: children } of values) {
    if (id === null || fields.has(id)) {
      throw new Error(`Expected a unique field name, received ${id}`);
    }
    fields.set(id, children);
  }
  return fields;
}

export function references(values) {
  return values.map(({ id, values: children }) => {
    if (id === null || children.length) {
      throw new Error('Expected a reference');
    }
    return id;
  });
}

export function reference(values) {
  if (values?.length !== 1) {
    throw new Error('Expected exactly one reference');
  }
  return references(values)[0];
}

export function namedLinks(values, name) {
  return values.map((link) => {
    if (link.id !== name) {
      throw new Error(`Expected a ${name} link`);
    }
    return link.values;
  });
}

export function formatRecord(id, fields) {
  return formatBinaryDocument([
    new Link(
      id,
      Object.entries(fields).map(
        ([name, value]) => new Link(name, [new Link(String(value))])
      )
    ),
  ]);
}
