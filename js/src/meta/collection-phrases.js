// Technical operation names stay quoted inside the language's own expression
// syntax. Profiles can supply their own phrases without changing vocabulary.
import { node, number } from './tree.js';
import { sqlBinaryOperators, sqlUnaryOperators } from './sql-values.js';
export const collectionKeys = [
  'process-arguments',
  'objpak-string-set',
  'set-insert',
  'prefix-update',
  'postfix-update',
  'sql-null',
  'sql-binary',
  'sql-between',
  'sql-in',
  'sql-unary',
  'sql-truth',
];
const slots = {
  'process-arguments': ['includeProgram'],
  'objpak-string-set': [],
  'set-insert': ['collection', 'value'],
  'prefix-update': ['operand', 'delta'],
  'postfix-update': ['operand', 'delta'],
  'sql-null': [],
  'sql-binary': ['operator', 'left', 'right'],
  'sql-between': ['value', 'lower', 'upper'],
  'sql-in': ['value', 'choices'],
  'sql-unary': ['operator', 'operand'],
  'sql-truth': ['operand'],
};
export function collectionTemplates(language) {
  const [open, close] = language.quotes;
  return Object.fromEntries(
    collectionKeys.map((key) => [
      key,
      [
        `${open}${key}${close}${slots[key].map((slot) => ` ({${slot}})`).join('')}${slots[key].length ? '' : ' ()'}`,
      ],
    ])
  );
}
function sqlOperation(key, values) {
  const [kind, operators] =
    key === 'sql-binary'
      ? ['SqlBinary', sqlBinaryOperators]
      : ['SqlUnary', sqlUnaryOperators];
  return values.operator?.kind === 'Text' &&
    operators.has(values.operator.value)
    ? node(kind, { ...values, operator: values.operator.value })
    : undefined;
}

function updateNode(key, values) {
  return values.delta?.kind === 'Number' &&
    [-1, 1].includes(values.delta.value) &&
    values.operand?.kind === 'Name'
    ? node('Update', {
        ...values,
        delta: values.delta.value,
        prefix: key === 'prefix-update',
      })
    : undefined;
}

export function collectionNode(key, values) {
  switch (key) {
    case 'sql-null':
      return node('Null');
    case 'sql-truth':
      return node('SqlTruth', values);
    case 'sql-between':
      return node('SqlBetween', values);
    case 'sql-in':
      return values.choices?.kind === 'ArrayLiteral'
        ? node('SqlIn', values)
        : undefined;
    case 'sql-binary':
    case 'sql-unary':
      return sqlOperation(key, values);
    case 'process-arguments':
      return values.includeProgram?.kind === 'Boolean'
        ? node('ProcessArguments', {
            includeProgram: values.includeProgram.value,
          })
        : undefined;
    case 'objpak-string-set':
      return node('SetLiteral', { elements: [], order: 'objpak-string' });
    case 'set-insert':
      return node('SetInsert', values);
    default:
      return updateNode(key, values);
  }
}
export function collectionPhrase(expression) {
  switch (expression.kind) {
    case 'Null':
      return { key: 'sql-null', slots: {} };
    case 'SqlTruth':
      return { key: 'sql-truth', slots: { operand: expression.operand } };
    case 'SqlBetween': {
      const { value, lower, upper } = expression;
      return { key: 'sql-between', slots: { value, lower, upper } };
    }
    case 'SqlIn': {
      const { value, choices } = expression;
      return { key: 'sql-in', slots: { value, choices } };
    }
    case 'SqlUnary':
      return {
        key: 'sql-unary',
        slots: {
          operator: node('Text', { value: expression.operator }),
          operand: expression.operand,
        },
      };
    case 'SqlBinary':
      return {
        key: 'sql-binary',
        slots: {
          operator: node('Text', { value: expression.operator }),
          left: expression.left,
          right: expression.right,
        },
      };
    case 'ProcessArguments':
      return {
        key: 'process-arguments',
        slots: {
          includeProgram: node('Boolean', { value: expression.includeProgram }),
        },
      };
    case 'SetLiteral':
      if (expression.order !== 'objpak-string' || expression.elements.length) {
        throw new Error('Only an empty Objpak string set has this phrase');
      }
      return { key: 'objpak-string-set', slots: {} };
    case 'SetInsert':
      return {
        key: 'set-insert',
        slots: { collection: expression.collection, value: expression.value },
      };
    case 'Update':
      return {
        key: expression.prefix ? 'prefix-update' : 'postfix-update',
        slots: { operand: expression.operand, delta: number(expression.delta) },
      };
    default:
      return undefined;
  }
}
