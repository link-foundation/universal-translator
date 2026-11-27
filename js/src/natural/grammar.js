// Resolve reusable phrase rules before compiling the language's semantic
// productions. The existing typed slots continue to parse nested expressions.
const maxDepth = 24;
const maxVariants = 64;
const maxLength = 4096;
const maxRules = 256;
const termName = /^[a-z][a-z0-9-]*$/u;

function expand(pattern, resolve) {
  if (pattern.length > maxLength) {
    throw new Error('Natural grammar phrase is too long');
  }
  let variants = [''];
  let offset = 0;
  for (const match of pattern.matchAll(/@([a-z][a-z0-9-]*)/gu)) {
    const literal = pattern.slice(offset, match.index);
    const alternatives = resolve(match[1]);
    if (variants.length * alternatives.length > maxVariants) {
      throw new Error('Too many natural grammar alternatives');
    }
    variants = variants.flatMap((prefix) =>
      alternatives.map((phrase) => prefix + literal + phrase)
    );
    if (variants.some((variant) => variant.length > maxLength)) {
      throw new Error('Natural grammar phrase is too long');
    }
    offset = match.index + match[0].length;
  }
  const suffix = pattern.slice(offset);
  return variants.map((prefix) => {
    if (prefix.length + suffix.length > maxLength) {
      throw new Error('Natural grammar phrase is too long');
    }
    return prefix + suffix;
  });
}

function expandRule(patterns, resolve) {
  if (!patterns.length || patterns.length > maxVariants) {
    throw new Error('Invalid number of natural grammar alternatives');
  }
  const variants = new Set();
  for (const pattern of patterns) {
    for (const phrase of expand(pattern, resolve)) {
      variants.add(phrase);
    }
    if (variants.size > maxVariants) {
      throw new Error('Too many natural grammar alternatives');
    }
  }
  return [...variants];
}

export function grammarProductions(fields, productionKeys) {
  const terms = new Map();
  const productions = new Map();
  for (const { id, values } of fields) {
    const entries = id === 'terms' ? terms : productions;
    if (id !== 'terms' && id !== 'productions') {
      throw new Error(`Unknown natural grammar field "${id}"`);
    }
    for (const entry of values) {
      const valid =
        id === 'terms'
          ? typeof entry.id === 'string' && termName.test(entry.id)
          : productionKeys.includes(entry.id);
      if (!valid || entries.has(entry.id) || entries.size >= maxRules) {
        throw new Error(
          `Invalid or repeated natural grammar rule "${entry.id}"`
        );
      }
      entries.set(
        entry.id,
        entry.values.map(({ id, values }) => {
          if (!id?.trim() || values.length) {
            throw new Error(
              `Invalid phrase in natural grammar rule "${entry.id}"`
            );
          }
          return id;
        })
      );
    }
  }

  const resolved = new Map();
  const resolve = (key, path = []) => {
    if (path.length >= maxDepth || path.includes(key)) {
      throw new Error(`Natural grammar recursion at "${key}"`);
    }
    if (!terms.has(key)) {
      throw new Error(`Unknown natural grammar term "${key}"`);
    }
    if (!resolved.has(key)) {
      resolved.set(
        key,
        expandRule(terms.get(key), (term) => resolve(term, [...path, key]))
      );
    }
    return resolved.get(key);
  };
  for (const key of terms.keys()) {
    resolve(key);
  }
  return Object.fromEntries(
    [...productions].map(([key, patterns]) => [
      key,
      expandRule(patterns, resolve),
    ])
  );
}
