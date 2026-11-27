import {
  portableRecordName,
  supportsRecords,
  validRecord,
} from './record-model.js';
import { recordLiteralType } from './record-instances.js';

export function writeRecord(emitter, definition) {
  if (!validRecord(definition)) {
    throw new Error(
      'A record requires one field per distinct constructor parameter'
    );
  }
  const { name, parameters, fields } = definition;
  emitter.comments(definition);
  if (emitter.id === 'javascript') {
    emitter.openBlock(`class ${name}`);
    emitter.comments(definition, 'constructorComments');
    emitter.openBlock(`constructor(${parameters.join(', ')})`);
    for (const field of fields) {
      emitter.recordField(field, `this.${field.name} = ${field.parameter};`);
    }
  } else {
    const types = new Map(
      parameters.map((parameter, index) => {
        const candidate = `Field${index}`;
        return [parameter, name === candidate ? `${candidate}Type` : candidate];
      })
    );
    const generic = types.size ? `<${[...types.values()].join(', ')}>` : '';
    emitter.openBlock(`pub struct ${name}${generic}`);
    for (const field of fields) {
      emitter.recordField(
        field,
        `pub ${field.name}: ${types.get(field.parameter)},`
      );
    }
    emitter.closeBlock();
    emitter.line();
    emitter.openBlock(`impl${generic} ${name}${generic}`);
    emitter.comments(definition, 'constructorComments');
    const args = parameters
      .map((parameter) => `${parameter}: ${types.get(parameter)}`)
      .join(', ');
    emitter.openBlock(`pub fn new(${args}) -> Self`);
    emitter.openBlock('Self');
    for (const field of fields) {
      emitter.recordField(field, `${field.name}: ${field.parameter},`);
    }
    emitter.closeBlock();
  }
  emitter.closeBlock();
  emitter.closeBlock();
}

export function writeRecordExpression(emitter, expression) {
  if (!supportsRecords(emitter.syntax)) {
    throw new Error(`Record instances cannot be emitted in ${emitter.id}`);
  }
  if (expression.kind === 'RecordFieldRead') {
    if (
      !portableRecordName(expression.property) ||
      expression.object?.kind !== 'Name'
    ) {
      throw new Error('A record field read requires a named object and field');
    }
    return `${emitter.expression(expression.object)}.${expression.property}`;
  }
  if (
    !portableRecordName(expression.record) ||
    !Array.isArray(expression.arguments) ||
    !expression.arguments.every(recordLiteralType)
  ) {
    throw new Error('A record constructor requires scalar literal arguments');
  }
  const rust = emitter.id === 'rust';
  const parameters = expression.arguments.map((value) => {
    const written = emitter.expression(value);
    return rust && value.kind === 'Number' ? `${written} as i64` : written;
  });
  const name = rust ? `${expression.record}::new` : `new ${expression.record}`;
  return `${name}(${parameters.join(', ')})`;
}
