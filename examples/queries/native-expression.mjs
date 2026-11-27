// Generated selection programs end with one expression after their helpers.
export function nativeExpression(source) {
  const lines = source.trimEnd().split('\n');
  return {
    prefix: lines.slice(0, -1).join('\n'),
    expression: lines.at(-1).replace(/;$/u, ''),
  };
}
