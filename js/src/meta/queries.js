import { node } from './tree.js';
import { inheritOrigin } from '../translation/source-origins.js';

// Visit references to one free variable without capturing a nested binder.
// A query's source is evaluated before its own range variable is introduced.
export function rewriteFree(expression, variable, visit) {
  const shadowed =
    expression.kind === 'Query' && expression.variable === variable;
  const lambda =
    expression.kind === 'Lambda' && expression.parameters.includes(variable);
  const child = (value) =>
    Array.isArray(value)
      ? value.map(child)
      : value?.kind
        ? rewriteFree(value, variable, visit)
        : value;
  const copy = Object.fromEntries(
    Object.entries(expression).map(([key, value]) => [
      key,
      (shadowed && key !== 'source') || (lambda && key === 'body')
        ? value
        : child(value),
    ])
  );
  return inheritOrigin(visit(inheritOrigin(copy, expression)), expression);
}

export const queryKeys = [
  'answer-query',
  'question-query',
  'answer-deferred-query',
  'question-deferred-query',
];
export const queryKey = (eager, question = false) =>
  `${question ? 'question' : 'answer'}-${eager ? '' : 'deferred-'}query`;
export const queryNode = (key, slots) =>
  node('Query', {
    ...slots,
    eager: !key.includes('deferred'),
  });

// A controlled query composes the language's loop, condition and result
// clauses using shared syntax rules.
export function derivedQueryTemplates(description) {
  const { templates } = description;
  const loop = templates['for-each']?.[0];
  const [open, close] = description.quotes ?? ['"', '"'];
  if (!loop) {
    return Object.fromEntries(
      queryKeys.map((key) => {
        const phrase = `${open}${key.includes('deferred') ? 'deferred-query' : 'query'}${close} ({source}) ({variable}) ({condition}) ({projection})`;
        return [
          key,
          [
            key.startsWith('question-')
              ? templates.evaluate[0].replace('{expression}', phrase)
              : phrase,
          ],
        ];
      })
    );
  }
  const phrase = [
    loop.replace('{array}', '{source}'),
    templates.if[0],
    templates['return-value'][0].replace('{value}', '{projection}'),
  ].join(', ');
  return Object.fromEntries(
    queryKeys.map((key) => [
      key,
      [
        `${key.includes('deferred') ? `${open}deferred${close} ` : ''}${phrase}`,
      ],
    ])
  );
}
