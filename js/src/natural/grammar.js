// Resolve reusable lexical rules and productions before compiling the
// language. Typed slots continue to parse nested expressions at runtime.
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

export function grammarProductions(fields, productionKeys, bindings) {
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
  return resolveProductions(terms, productions, bindings);
}

function resolveProductions(terms, productions, bindings) {
  for (const key of productions.keys()) {
    if (terms.has(key)) {
      throw new Error(`Repeated natural grammar rule "${key}"`);
    }
  }
  const rules = new Map([...terms, ...productions]);
  // Local rules shadow inherited expansions. References inside an inherited
  // expansion keep the meaning they had where the rule was defined.
  for (const key of rules.keys()) {
    bindings.delete(key);
  }
  if (bindings.size + rules.size > maxRules * 2) {
    throw new Error('Too many natural grammar rules');
  }
  const resolve = (key, path = []) => {
    if (path.length >= maxDepth || path.includes(key)) {
      throw new Error(`Natural grammar recursion at "${key}"`);
    }
    const known = bindings.get(key);
    if (known) {
      if (path.length + known.depth > maxDepth) {
        throw new Error(`Natural grammar recursion at "${key}"`);
      }
      return known;
    }
    const patterns = rules.get(key);
    if (!patterns) {
      throw new Error(`Unknown natural grammar rule "${key}"`);
    }
    const nextPath = [...path, key];
    let depth = 1;
    const variants = expandRule(patterns, (rule) => {
      const next = resolve(rule, nextPath);
      depth = Math.max(depth, next.depth + 1);
      return next.variants;
    });
    const expansion = { variants, depth };
    bindings.set(key, expansion);
    return expansion;
  };
  for (const key of terms.keys()) {
    resolve(key);
  }
  return Object.fromEntries(
    [...productions.keys()].map((key) => [key, resolve(key).variants])
  );
}
