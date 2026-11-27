// Shared, compositional integer algorithms. Rebuild data, not source programs.
import { writeFileSync } from 'node:fs';
import { node, block, name, number } from '../js/src/meta/tree.js';
import { inferTypes } from '../js/src/meta/types.js';
import { format } from 'prettier';
const binary = (operator, left, right) =>
  node('Binary', { operator, left, right });
const value = (operator) => binary(operator, name('first'), name('second'));
const residual = () =>
  binary(
    'subtract',
    name('first'),
    binary('multiply', name('quotient'), name('second'))
  );
const differentSigns = () =>
  binary(
    'notEqual',
    binary('less', name('first'), number(0)),
    binary('less', name('second'), number(0))
  );
const declaration = (identifier, expression, mutable = false) =>
  node('Declaration', { name: identifier, value: expression, mutable });
const operators = {
  floorDivide: 'floor-divide',
  divide: 'divide',
  modulo: 'modulo',
  remainder: 'remainder',
};
const helpers = Object.fromEntries(
  Object.entries(operators).map(([operator, suffix]) => {
    const division = ['divide', 'modulo'].includes(operator)
      ? 'floorDivide'
      : 'divide';
    const statements = [
      declaration(
        'quotient',
        value(division),
        ['divide', 'floorDivide'].includes(operator)
      ),
    ];
    if (['divide', 'floorDivide'].includes(operator)) {
      statements.push(declaration('residue', residual()));
      statements.push(
        node('If', {
          condition: binary('notEqual', name('residue'), number(0)),
          then: block([
            node('If', {
              condition:
                operator === 'divide'
                  ? binary('less', name('quotient'), number(0))
                  : differentSigns(),
              then: block([
                node('Assignment', {
                  name: 'quotient',
                  operator: '=',
                  value: binary(
                    operator === 'divide' ? 'add' : 'subtract',
                    name('quotient'),
                    number(1)
                  ),
                }),
              ]),
            }),
          ]),
        })
      );
    }
    if (['divide', 'floorDivide'].includes(operator)) {
      statements.push(
        node('If', {
          condition: binary('equal', name('quotient'), number(0)),
          then: block([
            node('Assignment', {
              name: 'quotient',
              operator: '=',
              value: number(0),
            }),
          ]),
        })
      );
    }
    statements.push(
      node('Return', {
        value: ['modulo', 'remainder'].includes(operator)
          ? residual()
          : name('quotient'),
      })
    );
    const helper = node('Function', {
      name: `ut-integer-${suffix}`,
      parameters: [
        { name: 'first', type: 'integer' },
        { name: 'second', type: 'integer' },
      ],
      returnType: 'integer',
      body: block(statements),
      comments: [],
    });
    return [
      operator,
      inferTypes(
        node('Program', {
          comments: [],
          imports: [],
          functions: [helper],
          main: block(),
        })
      ).functions[0],
    ];
  })
);
writeFileSync(
  new URL('../data/integer-arithmetic.json', import.meta.url),
  await format(
    JSON.stringify({
      floorDivision: ['python', 'ruby', 'lua', 'r'],
      floorModulo: ['python', 'ruby', 'lua', 'r', 'perl'],
      helpers,
    }),
    { parser: 'json' }
  )
);
