import { commentOrigins, expressionOrigins } from './source-origins.js';
import { transferLayout } from './layout.js';

const contexts = [];
const active = new WeakMap();
const lineOrigins = new WeakMap();

export const capturesEmission = () => contexts.length > 0;

// Capturing is synchronous and scoped, including reentrant translations by a
// decorator. Ordinary string-returning translations allocate no line records.
export function captureEmission(translate) {
  const context = { emissions: [] };
  contexts.push(context);
  try {
    return { result: translate(), emissions: context.emissions };
  } finally {
    contexts.pop();
  }
}

export function mappedEmitter(emitter) {
  if (!contexts.length) {
    return emitter;
  }
  const methods = new Map();
  return new Proxy(emitter, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver);
      if (typeof value !== 'function' || key === 'constructor') {
        return value;
      }
      if (!methods.has(key)) {
        methods.set(key, (...args) => {
          const previous = active.get(receiver);
          const origins = args[0]?.kind && expressionOrigins(args[0]);
          if (origins?.length) {
            active.set(receiver, origins);
          }
          try {
            return value.apply(receiver, args);
          } finally {
            active.set(receiver, previous);
          }
        });
      }
      return methods.get(key);
    },
  });
}

// Only internal emitter lines carry metadata; the public output is a string.
export function mappedLine(emitter, text, previous) {
  const origins = active.get(emitter);
  return mappedText(text, previous, origins);
}

export function mappedComments(emitter, texts, write) {
  const previous = active.get(emitter);
  try {
    texts.forEach((text, index) => {
      const origin = commentOrigins(texts)[index];
      active.set(emitter, origin ? [origin] : []);
      write(text);
    });
  } finally {
    active.set(emitter, previous);
  }
}

// Formatting changes the spelling of a line without changing its ownership.
export function mappedText(text, previous, origins) {
  const before = previous && lineOrigins.get(previous);
  if (!text || (!origins?.length && !before?.length)) {
    return text;
  }
  const line = Object(text);
  lineOrigins.set(line, [...(before ?? []), ...(origins ?? [])]);
  return line;
}

export function renderLines(emitter, lines, ending = '\n') {
  const text = `${lines.join('\n')}${ending}`;
  if (contexts.length) {
    const mapped = lines.flatMap((line, index) =>
      (lineOrigins.get(line) ?? []).map((origin) => ({
        ...origin,
        target: index,
      }))
    );
    if (mapped.length) {
      contexts.at(-1).emissions.push({
        language: emitter.syntax?.id ?? emitter.language.id,
        text,
        mapped,
      });
    }
  }
  return text;
}

// Partial recovery assembles separately emitted fragments. Retain their maps
// as one emission so later layout and style changes can align the whole text.
export function recordMapping(source, text, language, lines) {
  if (contexts.length) {
    contexts.at(-1).emissions.push({
      language,
      text,
      mapped: lines.map(([from, target]) => ({
        source,
        lines: [from],
        target,
      })),
    });
  }
}

// Layout, style, fragment extraction and output decorators can change target
// positions. Align the generated target with its final spelling in that same
// language; semantic source positions come from the tree, not token equality.
export function emittedMap(emissions, source, target, language, syntax) {
  const emission = emissions.findLast((item) => item.language === language);
  if (!emission) {
    return [];
  }
  const positions = new Map();
  const lines =
    emission.text === target
      ? emission.text.split('\n').map((_, line) => [line, line])
      : transferLayout(emission.text, target, syntax, syntax, {
          respace: false,
        }).lines;
  for (const [before, after] of lines) {
    if (!positions.has(before)) {
      positions.set(before, new Set());
    }
    positions.get(before).add(after);
  }
  const result = new Map();
  for (const origin of emission.mapped) {
    if (origin.source !== source) {
      continue;
    }
    for (const from of origin.lines) {
      for (const to of positions.get(origin.target) ?? []) {
        result.set(`${from}:${to}`, [from, to]);
      }
    }
  }
  return [...result.values()].sort(([a, b], [c, d]) => a - c || b - d);
}

export function mergeLineMaps(semantic, lexical) {
  const mapped = new Set(semantic.map(([, target]) => target));
  return [
    ...semantic,
    ...lexical.filter(([, target]) => !mapped.has(target)),
  ].sort(([a, b], [c, d]) => a - c || b - d);
}
