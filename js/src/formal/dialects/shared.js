// Helpers shared by the dialects: languages whose programs are laid out
// with keywords (begin ... end, if ... end if) and a declaration section,
// which the braces and indentation of the shared grammar do not cover.

import { node } from '../../meta/tree.js';

// A comment token as a Comment node, keeping where it stood (after code on
// the same line) and whether it was a block comment.
export function commentNode(token) {
  return node('Comment', {
    text: token.value,
    ...(token.trailing ? { trailing: token.trailing } : {}),
    ...(token.block ? { block: true } : {}),
  });
}

// Empty lines of a newline token as a Blank node, or nothing.
export const blankNode = (token, items) =>
  token.type === 'newline' && token.blank && items.length
    ? [node('Blank', { lines: token.blank })]
    : [];

// Parser helpers for keyword-delimited statements.
export const keywordParser = (Base) =>
  class KeywordParser extends Base {
    // Skip line ends and statement separators.
    // With `items`, empty lines between them are kept as Blank nodes.
    skipLines(items) {
      while (this.peek().type === 'newline' || this.is(';')) {
        const token = this.next();
        items?.push(...blankNode(token, items));
      }
    }

    // Statements and comments up to the word that ends the block.
    statementsUntil(done) {
      const statements = [];
      this.skipLines();
      while (!done() && this.peek().type !== 'end') {
        if (this.peek().type === 'comment') {
          statements.push(commentNode(this.next()));
        } else {
          statements.push(this.statement());
        }
        this.skipLines(statements);
      }
      return statements;
    }

    // Comments and line ends between top-level items.
    gatherComments(items) {
      while (this.peek().type === 'newline' || this.peek().type === 'comment') {
        const token = this.next();
        if (token.type === 'comment') {
          items.push(commentNode(token));
        } else {
          items.push(...blankNode(token, items));
        }
      }
    }

    // The meta type a language spells this way (Int64, Long, ...).
    typeOf(spelling) {
      const found = Object.entries(this.syntax.types ?? {}).find(
        ([, written]) =>
          written && written.toLowerCase() === spelling.toLowerCase()
      );
      return found?.[0];
    }

    // Words up to the end of the line, for headers the program ignores.
    skipLine() {
      while (this.peek().type !== 'newline' && this.peek().type !== 'end') {
        this.next();
      }
    }

    // A statement that only names a procedure calls it without arguments.
    called(expression) {
      return expression.kind === 'Name'
        ? node('Call', { callee: expression.name, arguments: [] })
        : expression;
    }
  };

// Visit every statement of a block, inner blocks included, in source order.
export function eachStatement(body, visit) {
  for (const statement of body?.statements ?? []) {
    visit(statement);
    for (const inner of [statement.then, statement.otherwise, statement.body]) {
      if (inner?.kind === 'Block') {
        eachStatement(inner, visit);
      } else if (inner?.kind === 'If') {
        eachStatement({ statements: [inner] }, visit);
      }
    }
  }
}

// The variables a body declares, with their meta types, for languages that
// declare every variable before the first statement. Counting loop
// variables are included unless the loop declares its own (Ada).
export function declaredVariables(body, { loops = true } = {}) {
  const found = new Map();
  eachStatement(body, (statement) => {
    if (statement.kind === 'Declaration' && !found.has(statement.name)) {
      found.set(statement.name, statement.type ?? 'integer');
    }
    if (statement.kind === 'CountingLoop' && loops) {
      if (!found.has(statement.variable)) {
        found.set(statement.variable, 'integer');
      }
    }
  });
  return found;
}

// The value a declaration without one starts from.
export const defaultValues = {
  integer: { kind: 'Number', value: 0 },
  text: { kind: 'Text', value: '' },
  boolean: { kind: 'Boolean', value: false },
};
