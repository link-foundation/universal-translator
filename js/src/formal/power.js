// Exponentiation binds tighter than unary negation and associates to the
// right. A caret denotes exponentiation only in these language grammars.
const caret = new Set(['lua', 'julia', 'r', 'matlab', 'vb']);
const stars = new Set([
  'javascript',
  'typescript',
  'python',
  'ruby',
  'php',
  'perl',
  'd',
  'groovy',
  'fortran',
  'ada',
  'bash',
]);

export function powerSymbol(id) {
  return caret.has(id) ? '^' : stars.has(id) ? '**' : undefined;
}

export function writePower(emitter, expression, parent) {
  const { left, right } = expression;
  if (emitter.id === 'rust') {
    if (expression.type === 'real') {
      return `(${emitter.expression(left)} as f64).powf(${emitter.expression(right)} as f64)`;
    }
    return `(${emitter.expression(left)} as i64).pow(${emitter.expression(right)} as u32)`;
  }
  const symbol = powerSymbol(emitter.id);
  if (!symbol) {
    throw new Error(`Exponentiation is not supported in ${emitter.id}`);
  }
  if (emitter.id === 'javascript' && emitter.syntax.version === 'es5') {
    return `Math.pow(${emitter.expression(left)}, ${emitter.expression(right)})`;
  }
  const result = `${emitter.expression(left, 9)} ${symbol} ${emitter.expression(right, 8)}`;
  return parent > 8 ? `(${result})` : result;
}
