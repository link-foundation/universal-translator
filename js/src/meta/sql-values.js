// Nullable SQL operations have their own value and truth contracts.
export const sqlBinaryOperators = new Set([
  'add',
  'subtract',
  'multiply',
  'divide',
  'realDivide',
  'remainder',
  'equal',
  'notEqual',
  'less',
  'lessOrEqual',
  'greater',
  'greaterOrEqual',
  'and',
  'or',
  'is',
  'isNot',
]);
export const sqlUnaryOperators = new Set([
  'not',
  'negate',
  'isTrue',
  'isFalse',
  'isNotTrue',
  'isNotFalse',
]);
