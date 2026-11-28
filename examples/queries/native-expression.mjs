// Generated selection programs end with one expression after their helpers.
export function nativeExpression(source) {
  const lines = source.trimEnd().split('\n');
  return {
    prefix: lines.slice(0, -1).join('\n'),
    expression: lines.at(-1).replace(/;$/u, ''),
  };
}

// Each helper version has its own scope, even when class names match.
export function nativeJavaScriptBatch(programs) {
  const groups = new Map();
  programs.forEach(({ prefix, expression }, index) => {
    if (!groups.has(prefix)) {
      groups.set(prefix, []);
    }
    groups.get(prefix).push(`results[${index}] = ${expression};`);
  });
  const blocks = Array.from(
    groups,
    ([prefix, calls]) => `{\n${prefix}\n${calls.join('\n')}\n}`
  );
  return `const results = [];\n${blocks.join('\n')}\nconsole.log(JSON.stringify(results));`;
}
