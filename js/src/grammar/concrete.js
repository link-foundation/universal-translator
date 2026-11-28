import { reconstructConcrete } from '../translation/concrete-syntax.js';
import { sourceLocator, withOrigin } from '../translation/source-origins.js';

// Grammar executors use byte offsets; source ownership uses string offsets.
export function sourceNode(source, kind, fields, range) {
  const bytes = new globalThis.TextEncoder().encode(source);
  if (
    !Number.isInteger(range.start) ||
    !Number.isInteger(range.end) ||
    range.start < 0 ||
    range.start > range.end ||
    range.end > bytes.length
  ) {
    throw new Error('Grammar tree has an invalid source range');
  }
  const decode = new globalThis.TextDecoder('utf-8', { fatal: true });
  const start = decode.decode(bytes.slice(0, range.start)).length;
  const end = decode.decode(bytes.slice(0, range.end)).length;
  return withOrigin({ kind, ...fields }, sourceLocator(source)(start, end));
}

const leafKind = (tree) =>
  tree.type === 'error' ? 'Error' : tree.trivia ? 'Trivia' : 'Token';

function checkRange(tree, bytes, parentStart, parentEnd) {
  if (
    !Number.isInteger(tree.start) ||
    !Number.isInteger(tree.end) ||
    tree.start < parentStart ||
    tree.end < tree.start ||
    tree.end > parentEnd ||
    (bytes[tree.start] & 0xc0) === 0x80 ||
    (bytes[tree.end] & 0xc0) === 0x80
  ) {
    throw new Error('Grammar tree has an invalid source range');
  }
}

export function grammarConcrete(source, language, outcome, provenance) {
  const bytes = new globalThis.TextEncoder().encode(source);
  const decode = new globalThis.TextDecoder('utf-8', { fatal: true });
  const children = [];
  const productions = [];
  const errors = [];
  let position = 0;
  const append = (kind, type, start, end) => {
    if (end > start) {
      children.push({
        kind,
        type,
        start,
        end,
        text: decode.decode(bytes.slice(start, end)),
      });
    }
  };
  const visit = (tree, parentStart = 0, parentEnd = bytes.length) => {
    checkRange(tree, bytes, parentStart, parentEnd);
    if (tree.type === 'node' || tree.type === 'embed') {
      productions.push({
        kind: 'Production',
        rule: tree.kind ?? tree.language,
        start: tree.start,
        end: tree.end,
      });
      for (const child of tree.children ?? [tree.root]) {
        visit(child, tree.start, tree.end);
      }
      return;
    }
    if (tree.type === 'error' || tree.type === 'missing') {
      errors.push({
        kind: 'Error',
        start: tree.start,
        end: tree.end,
        message: tree.reason ?? tree.type,
      });
    }
    if (tree.type === 'missing') {
      return;
    }
    if (tree.start < position) {
      throw new Error('Grammar tree has overlapping source leaves');
    }
    append('Trivia', 'layout', position, tree.start);
    append(leafKind(tree), tree.kind ?? tree.type, tree.start, tree.end);
    position = tree.end;
  };
  if (outcome.tree) {
    visit(outcome.tree);
  }
  append(outcome.ok ? 'Trivia' : 'Error', 'unread', position, bytes.length);
  if (outcome.rejection && errors.length === 0) {
    const start = outcome.rejection.offset ?? position;
    errors.push({
      kind: 'Error',
      start,
      end: bytes.length,
      message: outcome.rejection.reason,
    });
  }
  const syntax = {
    kind: 'ConcreteSyntax',
    language,
    unit: 'utf8',
    start: 0,
    end: bytes.length,
    children,
    productions,
    errors,
    grammar: provenance,
    tree: outcome.tree,
  };
  if (reconstructConcrete(syntax) !== source) {
    throw new Error('Grammar tree did not preserve the source');
  }
  return syntax;
}
