// Technical operation names stay quoted inside the language's own expression
// syntax. Profiles can supply their own phrases without changing vocabulary.
import { node, number } from './tree.js';
export const collectionKeys = [
  'process-arguments',
  'objpak-string-set',
  'set-insert',
  'prefix-update',
  'postfix-update',
];
const slots = {
  'process-arguments': ['includeProgram'],
  'objpak-string-set': [],
  'set-insert': ['collection', 'value'],
  'prefix-update': ['operand', 'delta'],
  'postfix-update': ['operand', 'delta'],
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
export function collectionNode(key, values) {
  switch (key) {
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
}
export function collectionPhrase(expression) {
  switch (expression.kind) {
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
