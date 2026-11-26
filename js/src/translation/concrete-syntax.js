// A concrete tree owns every source byte. Grammar productions are views over
// its token stream; semantic nodes can change without changing that record.
import { sourceLocator, withOrigin } from './source-origins.js';

function byteOffsets(source) {
  const offsets = new Uint32Array(source.length + 1);
  let position = 0;
  let bytes = 0;
  for (const character of source) {
    offsets[position] = bytes;
    position += character.length;
    const code = character.codePointAt(0);
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
    offsets[position] = bytes;
  }
  return offsets;
}

// Observe the grammar's existing methods, including dialect overrides. Only
// nodes reachable from the accepted parse become productions in the CST.
export function concreteParser(parser, source) {
  const locate = sourceLocator(source);
  const locations = new WeakMap();
  const methods = new Map();
  const proxy = new Proxy(parser, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver);
      if (typeof value !== 'function' || key === 'constructor') {
        return value;
      }
      if (!methods.has(key)) {
        methods.set(key, (...args) => {
          const start = target.position;
          const result = value.apply(receiver, args);
          if (result?.kind && !locations.has(result)) {
            const consumed = target.tokens.slice(start, target.position);
            const first = consumed.find((token) => token.rawSpan);
            const last = consumed.findLast((token) => token.rawSpan);
            if (first && last) {
              locations.set(result, {
                rule: String(key),
                start: first.rawSpan[0],
                end: last.rawSpan[1],
              });
              withOrigin(result, locate(first.rawSpan[0], last.rawSpan[1]));
            }
          }
          return result;
        });
      }
      return methods.get(key);
    },
  });
  return { parser: proxy, locations };
}

function productions(tree, locations, offsets) {
  const result = [];
  const visit = (value) => {
    if (!value || typeof value !== 'object') {
      return;
    }
    const location = locations.get(value);
    if (location) {
      result.push({
        kind: 'Production',
        rule: location.rule,
        concept: value.kind,
        start: offsets[location.start],
        end: offsets[location.end],
      });
    }
    Object.values(value).forEach(visit);
  };
  visit(tree);
  return result;
}

// Token boundaries use the lexer's string offsets; the public CST uses UTF-8
// byte ranges, matching Meta Language and tree-sitter across both runtimes.
export function concreteSyntax(source, language, tokens, tree, locations) {
  const offsets = byteOffsets(source);
  const children = [];
  let position = 0;
  const append = (kind, type, start, end) => {
    if (end > start) {
      children.push({
        kind,
        type,
        start: offsets[start],
        end: offsets[end],
        text: source.slice(start, end),
      });
    }
  };
  for (const token of tokens) {
    if (!token.rawSpan) {
      continue;
    }
    const [start, end] = token.rawSpan;
    append('Trivia', 'layout', position, start);
    append('Token', token.type, start, end);
    position = end;
  }
  append('Trivia', 'layout', position, source.length);
  return {
    kind: 'ConcreteSyntax',
    language,
    unit: 'utf8',
    start: 0,
    end: offsets[source.length],
    children,
    productions: productions(tree, locations, offsets),
  };
}

export const reconstructConcrete = (syntax) =>
  syntax.children.map((child) => child.text).join('');
