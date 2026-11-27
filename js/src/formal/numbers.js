// Real numbers and the two divisions of the meta language. The operator
// "divide" is integer division (it truncates), "realDivide" is true division
// and gives a real. What a language's `/` means depends on the language:
// true division in the languages below, and in the others integer division
// of two integers and true division as soon as one operand is real.
import { floorDivision, floorModulo } from '../meta/integer-arithmetic.js';

const trueDivision = new Set([
  'javascript',
  'typescript',
  'python',
  'lua',
  'php',
  'perl',
  'julia',
  'r',
  'groovy',
  'matlab',
  'pascal',
  'nim',
  'dart',
  'vb',
  'gml',
]);

// Whether `/` of two integers gives a real (Python 2 divides integers).
export const slashIsReal = (syntax) =>
  trueDivision.has(syntax.id) &&
  !(syntax.id === 'python' && syntax.version === '2');

// The meta operator a language's `/` stands for.
export const slashOperator = (syntax) =>
  slashIsReal(syntax)
    ? 'realDivide'
    : floorDivision(syntax.id)
      ? 'floorDivide'
      : 'divide';

export function arithmeticOperator(syntax, surface, operator) {
  if (operator === 'divide') {
    return surface === '/'
      ? slashOperator(syntax)
      : floorDivision(syntax.id)
        ? 'floorDivide'
        : 'divide';
  }
  return operator === 'remainder' && floorModulo(syntax.id)
    ? 'modulo'
    : operator;
}

// How a language turns an integer into a real: `{}` stands for the integer.
const casts = {
  c: '(double) {}',
  cpp: '(double) {}',
  objc: '(double) {}',
  csharp: '(double) {}',
  java: '(double) {}',
  d: 'cast(double) {}',
  kotlin: '{}.toDouble()',
  scala: '{}.toDouble',
  ruby: '{}.to_f',
  fortran: 'real({}, 8)',
  python: 'float({})',
  go: 'float64({})',
  rust: '{} as f64',
  swift: 'Double({})',
  zig: '@as(f64, @floatFromInt({}))',
  ada: 'Long_Float ({})',
  lean: 'Float.ofInt {}',
  nim: 'float({})',
  dart: '{}.toDouble()',
};

// Languages with one type for all numbers write 2.0 as 2.
const oneNumberType = new Set(['javascript', 'typescript']);
// Languages that never mix integers and reals in one operation.
const strict = new Set(['go', 'rust', 'swift', 'zig', 'ada', 'lean', 'nim']);
// Languages whose variables take the type of their first value, so a real
// variable starts from a real.
const typedByValue = new Set([...strict, 'kotlin', 'dart']);

// How each typed language spells the meta type "real".
export const realTypes = {
  typescript: 'number',
  python: 'float',
  ruby: 'Float',
  lua: 'number',
  php: 'float',
  c: 'double',
  cpp: 'double',
  csharp: 'double',
  java: 'double',
  go: 'float64',
  rust: 'f64',
  kotlin: 'Double',
  swift: 'Double',
  dart: 'double',
  scala: 'Double',
  julia: 'Float64',
  r: 'numeric',
  groovy: 'double',
  objc: 'double',
  nim: 'float',
  d: 'double',
  pascal: 'Double',
  fortran: 'real(8)',
  ada: 'Long_Float',
  vb: 'Double',
  matlab: 'double',
  zig: 'f64',
  lean: 'Float',
};

const arithmetic = new Set([
  'add',
  'subtract',
  'multiply',
  'divide',
  'floorDivide',
  'realDivide',
  'remainder',
  'modulo',
]);
const comparisons = new Set([
  'equal',
  'notEqual',
  'less',
  'lessOrEqual',
  'greater',
  'greaterOrEqual',
]);

// The written form of a real literal: 2 is written 2.0, so it stays real.
export function realText(value) {
  if (Number.isInteger(value) && Math.abs(value) < 1e21) {
    return `${value}.0`;
  }
  return String(value);
}

// Whether a meta expression is a real.
export const isReal = (expression) =>
  expression?.type === 'real' ||
  (expression?.kind === 'Number' && !Number.isInteger(expression.value));

// A number the writer adds, such as the 0 of `let t;`, has no type yet.
const isInteger = (expression) =>
  !isReal(expression) &&
  (expression.type === 'integer' ||
    (expression.kind === 'Number' && expression.type === undefined));

// The integer operand as a real: a literal becomes a real literal, another
// expression is converted.
const asReal = (operand) =>
  operand.kind === 'Number'
    ? { ...operand, type: 'real' }
    : { kind: 'ToReal', operand, type: 'real' };

// Which operands of a binary operation a language must write as reals:
// both integer operands of a true division (only the left one where one
// real operand is enough), and in strict languages every integer operand
// that meets a real.
function convertedSides(expression, syntax) {
  const { operator, left, right } = expression;
  const id = syntax.id;
  if (operator === 'realDivide' && !slashIsReal(syntax)) {
    if (strict.has(id)) {
      return [isInteger(left), isInteger(right)];
    }
    return [isInteger(left) && isInteger(right), false];
  }
  const mixed =
    (arithmetic.has(operator) || comparisons.has(operator)) &&
    (isReal(left) || isReal(right));
  if (strict.has(id) && mixed) {
    return [isInteger(left), isInteger(right)];
  }
  return [false, false];
}

// A binary operation with the operands the language needs as reals marked.
export function withRealOperands(expression, syntax) {
  if (!casts[syntax.id]) {
    return expression;
  }
  const [left, right] = convertedSides(expression, syntax);
  if (!left && !right) {
    return expression;
  }
  return {
    ...expression,
    left: left ? asReal(expression.left) : expression.left,
    right: right ? asReal(expression.right) : expression.right,
  };
}

// The first value of a real variable: an integer literal is written as a
// real literal, and another integer expression is converted where the
// language would otherwise give the variable an integer type.
export function realValue(value, type, syntax) {
  if (type !== 'real' || !value || !isInteger(value)) {
    return value;
  }
  return value.kind === 'Number' || typedByValue.has(syntax.id)
    ? asReal(value)
    : value;
}

// `{}` filled with the converted expression; an expression before a suffix
// or after a prefix word is kept whole with parentheses.
export function castText(syntax, written, atomic) {
  const template = casts[syntax.id];
  const tight = template.startsWith('{}') || template.endsWith(' {}');
  return template.replace('{}', tight ? atomic() : written());
}

// Real emitting for the shared emitter: types, literals, conversions.
export const withReals = (Base) =>
  class RealEmitter extends Base {
    type(meta) {
      if (meta === 'real' && this.syntax.types) {
        return realTypes[this.syntax.id] ?? super.type('integer');
      }
      return super.type(meta);
    }

    expression(expression, parent = 0) {
      if (expression.kind === 'ToReal') {
        return this.toReal(expression.operand, parent);
      }
      return super.expression(expression, parent);
    }

    number(expression, parent) {
      if (expression.type !== 'real' || oneNumberType.has(this.syntax.id)) {
        return super.number(expression, parent);
      }
      const { value } = expression;
      let written = realText(value);
      if (this.syntax.id === 'fortran') {
        written = /e/.test(written)
          ? written.replace('e', 'd')
          : `${written}d0`;
      }
      return value < 0 && parent > 6 ? `(${written})` : written;
    }

    toReal(operand, parent) {
      const written = castText(
        this.syntax,
        () => this.expression(operand),
        () => this.expression(operand, 8)
      );
      // Rust reads `a as f64 < b` as the start of a generic type.
      return this.syntax.id === 'rust' && parent === 4
        ? `(${written})`
        : written;
    }

    binary(expression, parent) {
      return super.binary(withRealOperands(expression, this.syntax), parent);
    }
  };
