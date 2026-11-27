import { walk } from '../meta/tree.js';
import { avoidReserved } from './names.js';

const strictWords =
  '_ abstract become box do final gen implements interface macro override priv protected public try typeof union unsized virtual yield'.split(
    ' '
  );

export function portableRecordName(name) {
  return (
    typeof name === 'string' &&
    /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) &&
    !['__proto__', 'Self', 'arguments', 'eval', ...strictWords].includes(
      name
    ) &&
    avoidReserved(name, 'javascript') === name &&
    avoidReserved(name, 'rust') === name
  );
}

export function supportsRecords(syntax) {
  return (
    syntax.id === 'rust' ||
    (syntax.id === 'javascript' && syntax.declarationKeyword !== 'var')
  );
}

export function requireRecordSupport(program, target, supported) {
  if (program.definitions?.length && !supported) {
    throw new Error(`Record definitions cannot be emitted in ${target}`);
  }
}

export function validRecord(definition) {
  const { name, parameters, fields } = definition;
  if (
    definition.kind !== 'RecordDefinition' ||
    !portableRecordName(name) ||
    !Array.isArray(parameters) ||
    !Array.isArray(fields) ||
    parameters.length !== fields.length ||
    !parameters.every(portableRecordName)
  ) {
    return false;
  }
  const inputs = new Set(parameters);
  const names = new Set();
  const bound = new Set();
  for (const field of fields) {
    if (
      field?.kind !== 'RecordField' ||
      !portableRecordName(field.name) ||
      names.has(field.name) ||
      !inputs.has(field.parameter) ||
      bound.has(field.parameter)
    ) {
      return false;
    }
    names.add(field.name);
    bound.add(field.parameter);
  }
  return inputs.size === parameters.length;
}

// Until a reference has a portable representation, emitting it verbatim can
// produce a valid definition alongside invalid or misleading executable code.
export function checkRecordReferences(program) {
  const names = new Set(program.definitions.map(({ name }) => name));
  if (names.size !== program.definitions.length) {
    throw new Error('Duplicate record definitions');
  }
  walk(program, (current) => {
    const name =
      current.kind === 'Name'
        ? current.name
        : current.kind === 'Call'
          ? current.callee.replace(/^new /, '')
          : null;
    if (name && names.has(name.split(/::|[.]/u)[0])) {
      throw new Error(
        'Record construction and references require instance translation'
      );
    }
  });
}
