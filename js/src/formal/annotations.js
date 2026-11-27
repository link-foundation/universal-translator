// Declaration and parameter annotations are explicit expression nodes.
import { node } from '../meta/tree.js';
import { sourceType } from './parser.js';
import { tokenize } from './lexer.js';

const annotatedLanguages = new Set(['java', 'kotlin', 'python']);

// Commas inside a generic type are not parameter separators. A lexer may
// combine the closing brackets of nested Java generics into one >> token.
export function typeDepth(value) {
  return ['<', '['].includes(value)
    ? 1
    : ({ '>': -1, ']': -1, '>>': -2 }[value] ?? 0);
}

export function typeHeadLength(parser) {
  if (
    parser.syntax.id === 'csharp' &&
    parser.is('from') &&
    parser.is('in', 2)
  ) {
    return 0;
  }
  let offset = 0;
  let depth = 0;
  while (true) {
    const token = parser.peek(offset);
    if (
      token.type !== 'name' &&
      !['*', '::', '.', '[', ']', '<', '>', '>>'].includes(token.value) &&
      !(depth > 0 && [',', '?'].includes(token.value))
    ) {
      return offset;
    }
    depth += typeDepth(token.value);
    offset += 1;
  }
}

export const withAnnotations = (Base) =>
  class extends Base {
    annotations() {
      const annotations = [];
      while (annotatedLanguages.has(this.syntax.id) && this.accept('@')) {
        annotations.push(node('Annotation', { expression: this.postfix() }));
        this.skipLineEnds();
      }
      return annotations;
    }

    item() {
      const annotations = this.annotations();
      const item = super.item();
      return annotations.length ? { ...item, annotations } : item;
    }

    parameterList() {
      if (this.syntax.id === 'kotlin') {
        return this.annotatedParameters();
      }
      if (this.syntax.typed !== 'prefix') {
        const parameters = super.parameterList();
        return this.syntax.id === 'python'
          ? parameters.map((parameter) => this.annotatedHint(parameter))
          : parameters;
      }
      this.expect('(');
      const parameters = [];
      this.skipLineEnds();
      if (
        ['c', 'cpp', 'objc'].includes(this.syntax.id) &&
        this.is('void') &&
        this.is(')', 1)
      ) {
        this.next();
      }
      while (!this.is(')')) {
        const annotations = this.annotations();
        const words = [];
        let depth = 0;
        while (depth > 0 || (!this.is(',') && !this.is(')'))) {
          depth += typeDepth(this.peek().value);
          if (this.peek().type === 'newline') {
            this.next();
          } else {
            words.push(this.next().value);
          }
        }
        parameters.push({
          name: words.pop(),
          type: sourceType(words.join(' ')),
          ...(annotations.length ? { annotations } : {}),
        });
        if (!this.accept(',')) {
          break;
        }
        this.skipLineEnds();
      }
      this.expect(')');
      return parameters;
    }

    annotatedParameters() {
      this.expect('(');
      this.skipLineEnds();
      const parameters = [];
      while (!this.is(')')) {
        const annotations = this.annotations();
        const name = this.expectName();
        const type = this.accept(':') ? this.typeExpression() : undefined;
        parameters.push({
          name,
          type,
          ...(annotations.length ? { annotations } : {}),
        });
        this.skipLineEnds();
        if (!this.accept(',')) {
          break;
        }
        this.skipLineEnds();
      }
      this.expect(')');
      return parameters;
    }

    annotatedHint(parameter) {
      const prefix = 'source:Annotated[';
      if (!parameter.type?.startsWith(prefix)) {
        return parameter;
      }
      const parser = new this.constructor(
        tokenize(parameter.type.slice('source:'.length), this.syntax),
        this.syntax
      );
      parser.expect('Annotated');
      parser.expect('[');
      const type = parser.typeHint();
      const annotations = [];
      while (parser.accept(',')) {
        annotations.push(
          node('Annotation', { expression: parser.expression() })
        );
      }
      parser.expect(']');
      return { ...parameter, type, annotations };
    }
  };
