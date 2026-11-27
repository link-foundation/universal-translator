import { name, node } from '../meta/tree.js';
import { SyntaxError } from './lexer.js';

export function questionSuffix(parser, expression) {
  if (parser.syntax.id !== 'python' || !parser.accept('?')) {
    return expression;
  }
  parser.expect('?');
  if (expression.kind !== 'Name') {
    throw new SyntaxError(
      'Detailed inspection requires an entity name',
      parser.peek().line
    );
  }
  return node('Question', { aspect: 'details', subject: expression });
}

export function propertyAssignment(parser, expression) {
  const property =
    expression.kind === 'Name'
      ? /^(.*)\.([\p{L}_][\p{L}\p{N}_]*)$/u.exec(expression.name)
      : undefined;
  const object = property ? name(property[1]) : expression.receiver;
  const field = property?.[2] ?? expression.name;
  if (!object || !['Name', 'Method'].includes(expression.kind)) {
    throw new SyntaxError(
      'Expected an assignable property',
      parser.peek().line
    );
  }
  const value = parser.expression();
  parser.endStatement();
  return node('PropertyAssignment', { object, property: field, value });
}
