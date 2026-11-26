// Lossless source records for line-oriented readers and error recovery. These
// lexical leaves do not claim that an unsupported fragment parsed successfully.
import { byteOffsets, concreteSyntax } from './concrete-syntax.js';
import { sourceOrigin } from './source-origins.js';

const lexemes = /[\p{L}\p{M}\p{N}_\u200c\u200d]+|[^\s]/gu;

function lineStarts(source) {
  return [
    0,
    ...Array.from(source.matchAll(/\n/gu), (match) => match.index + 1),
  ];
}

function sourceProductions(source, tree, starts, offsets) {
  const result = [];
  const visit = (value) => {
    if (!value || typeof value !== 'object') {
      return;
    }
    const origin = sourceOrigin(value);
    if (origin?.source === source) {
      // Lifted instructions can be discontiguous. Separate views avoid
      // claiming that intervening instructions belong to the same concept.
      const lines = [...new Set(origin.lines)].sort((a, b) => a - b);
      for (let index = 0; index < lines.length; index += 1) {
        const first = lines[index];
        let last = first;
        while (lines[index + 1] === last + 1) {
          last = lines[++index];
        }
        if (starts[first] !== undefined) {
          result.push({
            kind: 'Production',
            rule: 'source-lines',
            concept: value.kind,
            start: offsets[starts[first]],
            end: offsets[starts[last + 1] ?? source.length],
          });
        }
      }
    }
    Object.values(value).forEach(visit);
  };
  visit(tree);
  return result;
}

export function sourceSyntax(source, language, tree, parts) {
  const tokens = Array.from(source.matchAll(lexemes), (match) => ({
    type: /^[\p{L}\p{M}\p{N}_]/u.test(match[0]) ? 'word' : 'symbol',
    rawSpan: [match.index, match.index + match[0].length],
  }));
  const syntax = concreteSyntax(source, language, tokens);
  const starts = lineStarts(source);
  const offsets = byteOffsets(source);
  syntax.productions = sourceProductions(source, tree, starts, offsets);
  if (parts) {
    for (const part of parts) {
      const start = offsets[starts[part.start] ?? source.length];
      const end = offsets[starts[part.end] ?? source.length];
      if (part.status === 'read') {
        syntax.productions.push({
          kind: 'Production',
          rule: 'fragment',
          concept: part.kind,
          start,
          end,
        });
      } else {
        syntax.errors.push({
          kind: 'Error',
          start,
          end,
          message: part.message,
        });
      }
    }
  }
  return syntax;
}

export const sourceTree = (source, language, tree) => ({
  kind: 'SourceProgram',
  language,
  syntax: sourceSyntax(source, language, tree),
});
