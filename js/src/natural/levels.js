// Expression precedence shared by the writer and the reader, lowest first.
// A level lists the templates that build an expression at that level and
// how their operands bind:
//
//   left      left-associative binary: {left} at this level, {right} above
//   none      non-associative binary: both operands one level above
//   prefix    unary: {operand} at this same level

export const levels = [
  { name: 'join', templates: ['join'], associativity: 'left' },
  { name: 'or', templates: ['or'], associativity: 'left' },
  { name: 'and', templates: ['and'], associativity: 'left' },
  { name: 'not', templates: ['not'], associativity: 'prefix' },
  {
    name: 'comparison',
    templates: [
      'equal',
      'not-equal',
      'less',
      'less-or-equal',
      'greater',
      'greater-or-equal',
    ],
    associativity: 'none',
  },
  { name: 'additive', templates: ['add', 'subtract'], associativity: 'left' },
  {
    name: 'multiplicative',
    templates: ['multiply', 'divide', 'remainder'],
    associativity: 'left',
  },
  { name: 'negate', templates: ['negate'], associativity: 'prefix' },
  { name: 'primary', templates: [], associativity: 'none' },
];

export const levelIndex = Object.fromEntries(
  levels.map((level, index) => [level.name, index])
);

// Meta operator name <-> template key.
export const binaryTemplates = {
  or: 'or',
  and: 'and',
  equal: 'equal',
  notEqual: 'not-equal',
  less: 'less',
  lessOrEqual: 'less-or-equal',
  greater: 'greater',
  greaterOrEqual: 'greater-or-equal',
  add: 'add',
  subtract: 'subtract',
  multiply: 'multiply',
  // Prose has one division; it reads back as the meta "divide".
  realDivide: 'divide',
  divide: 'divide',
  remainder: 'remainder',
};

export const unaryTemplates = { not: 'not', negate: 'negate' };

export const operatorOfTemplate = Object.fromEntries(
  [...Object.entries(binaryTemplates), ...Object.entries(unaryTemplates)].map(
    ([operator, key]) => [key, operator]
  )
);

export const levelOfTemplate = Object.fromEntries(
  levels.flatMap((level, index) =>
    level.templates.map((template) => [template, index])
  )
);
