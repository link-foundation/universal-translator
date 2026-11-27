// How the shared parser reads arrays: literals, the constructors written as
// syntax (`new int[n]`, `vec![v; n]`, `[Int](repeating: v, count: n)`),
// indexing with brackets and element assignment. Library
// calls that create or measure an array are read by the rules in arrays.js.

import { SyntaxError } from './lexer.js';
import { name, node, number } from '../meta/tree.js';
import { offset } from './arrays.js';

// Languages whose array literals are written between braces.
const braceLiterals = new Set([
  'c',
  'objc',
  'cpp',
  'csharp',
  'java',
  'lua',
  'vb',
]);
// Languages that index with parentheses, like a call: a(i).
const parenthesesIndex = new Set(['scala', 'matlab', 'fortran', 'vb', 'ada']);
// Type words a C cast may name: (int) value.
const castTypes = new Set(['int', 'long', 'size_t']);

const assignmentSymbols = ['=', '+=', '-=', '*=', '/=', '%='];
const compoundMeanings = {
  '+=': 'add',
  '-=': 'subtract',
  '*=': 'multiply',
  '/=': 'divide',
  '%=': 'remainder',
};
// The method that reads each constructor, by the word it starts with.
const constructorReaders = {
  new: 'newConstructor',
  'vec!': 'vecMacro',
  IntArray: 'kotlinIntArray',
  Array: 'scalaArrayFill',
  sizeof: 'sizeOf',
  cast: 'namedCast',
};

// Arrays built by a named constructor, a cast or a Perl list.
const withArrayConstructors = (Base) =>
  class ArrayConstructorParser extends Base {
    // The reader of a constructor named by its first word, if any.
    namedConstructor(word) {
      const reader = Object.hasOwn(constructorReaders, word)
        ? constructorReaders[word]
        : undefined;
      return reader ? this[reader]() : undefined;
    }

    newConstructor() {
      if (this.syntax.id === 'csharp' && this.is('[', 1) && this.is(']', 2)) {
        this.position += 3;
        this.expect('{');
        return node('ArrayLiteral', { elements: this.elementList('}') });
      }
      // Java, Groovy and D: new int[n], filled with zeros.
      if (this.peek(1).type === 'name' && this.is('[', 2)) {
        this.next();
        this.next();
        this.next();
        const length = this.expression();
        this.expect(']');
        return node('NewArray', { length, fill: number(0) });
      }
      // JavaScript: new Array(n), filled later.
      if (this.peek(1).type === 'name' && this.is('(', 2)) {
        this.next();
        return name(`new ${this.next().value}`);
      }
      return undefined;
    }

    // Rust: vec![a, b] and vec![v; n].
    vecMacro() {
      if (!this.is('[', 1)) {
        return undefined;
      }
      this.next();
      this.next();
      const first = this.expression();
      if (this.accept(';')) {
        const length = this.expression();
        this.expect(']');
        return node('NewArray', { length, fill: first });
      }
      const rest = this.accept(',') ? this.elementList(']') : [];
      if (!rest.length) {
        this.expect(']');
      }
      return node('ArrayLiteral', { elements: [first, ...rest] });
    }

    // Kotlin: IntArray(n) { v }.
    kotlinIntArray() {
      if (!this.is('(', 1)) {
        return undefined;
      }
      this.next();
      this.next();
      const length = this.expression();
      this.expect(')');
      this.expect('{');
      const fill = this.expression();
      this.expect('}');
      return node('NewArray', { length, fill });
    }

    // Scala: Array.fill(n)(v).
    scalaArrayFill() {
      if (!this.is('.', 1) || !this.is('fill', 2)) {
        return undefined;
      }
      this.position += 3;
      this.expect('(');
      const length = this.expression();
      this.expect(')');
      this.expect('(');
      const fill = this.expression();
      this.expect(')');
      return node('NewArray', { length, fill });
    }

    // C: sizeof a.
    sizeOf() {
      this.next();
      return node('SizeOf', { operand: this.unary() });
    }

    // D: cast(long) value.
    namedCast() {
      if (!this.is('(', 1) || !this.is(')', 3)) {
        return undefined;
      }
      this.position += 4;
      return this.unary();
    }

    // C and C++: (int) value.
    cast() {
      if (
        this.is('(') &&
        castTypes.has(this.peek(1).value) &&
        this.is(')', 2) &&
        ['c', 'objc', 'cpp'].includes(this.syntax.family ?? this.syntax.id)
      ) {
        this.position += 3;
        return this.unary();
      }
      return undefined;
    }

    // Perl: (a, b, c), and (v) x n for n copies of v.
    perlList() {
      this.next();
      const elements = this.elementList(')');
      if (this.accept('x')) {
        return node('NewArray', { length: this.unary(), fill: elements[0] });
      }
      return elements.length === 1
        ? elements[0]
        : node('ArrayLiteral', { elements });
    }
  };

// Array expressions: literals, indexing and the length operator.
const withArrayExpressions = (Base) =>
  class ArrayExpressionParser extends Base {
    // a, b, c up to the closing symbol.
    elementList(close) {
      const elements = [];
      this.skipLineEnds();
      while (!this.is(close)) {
        elements.push(this.expression());
        this.skipLineEnds();
        if (!this.accept(',')) {
          break;
        }
        this.skipLineEnds();
      }
      this.expect(close);
      return elements;
    }

    skipLineEnds() {
      while (this.peek().type === 'newline') {
        this.next();
      }
    }

    literal(close) {
      return node('ArrayLiteral', { elements: this.elementList(close) });
    }

    primary() {
      const read = this.arrayPrimary();
      let expression = read ?? super.primary();
      // a[i], counted from 1 in Lua, Julia and R.
      while (
        expression.kind === 'Name' &&
        this.is('[') &&
        !parenthesesIndex.has(this.syntax.id)
      ) {
        this.next();
        const index = this.expression();
        this.expect(']');
        expression = node('Index', {
          array: expression,
          index: offset(index, -(this.syntax.arrayBase ?? 0)),
        });
      }
      return expression;
    }

    arrayPrimary() {
      const id = this.syntax.family ?? this.syntax.id;
      const token = this.peek();
      if (this.is('[')) {
        return this.bracketPrimary();
      }
      if (this.is('{') && braceLiterals.has(id)) {
        this.next();
        return this.literal('}');
      }
      // Nim: @[a, b]. Perl: @name.
      if (this.is('@') && this.is('[', 1)) {
        this.next();
        this.next();
        return this.literal(']');
      }
      if (this.is('@') && this.peek(1).type === 'name' && id === 'perl') {
        this.next();
        return name(this.next().value);
      }
      if (token.type !== 'name') {
        return id === 'perl' && this.is('(') ? this.perlList() : this.cast();
      }
      return this.namedConstructor(token.value);
    }

    // [a, b], Go's []int{a, b} and []int, Swift's [Int](repeating:count:).
    bracketPrimary() {
      this.next();
      if (this.is(']') && this.peek(1).type === 'name') {
        this.next();
        this.next();
        if (this.is('{')) {
          this.next();
          return this.literal('}');
        }
        return node('ArrayType', {});
      }
      if (
        this.peek().type === 'name' &&
        this.is(']', 1) &&
        this.is('(', 2) &&
        this.is('repeating', 3)
      ) {
        this.next();
        this.next();
        this.next();
        const values = {};
        for (const label of ['repeating', 'count']) {
          this.expect(label);
          this.expect(':');
          values[label] = this.expression();
          this.accept(',');
        }
        this.expect(')');
        return node('NewArray', {
          length: values.count,
          fill: values.repeating,
        });
      }
      return this.literal(']');
    }

    unary() {
      // Lua: #a is the length of a.
      if (this.syntax.id === 'lua' && this.accept('#')) {
        return node('Length', { array: this.unary() });
      }
      const value = super.unary();
      // Rust: value as i64. The conversion only changes the integer width.
      if (this.syntax.id === 'rust' && this.accept('as')) {
        this.expectName();
      }
      return value;
    }
  };

// Array statements: declarations and element assignments.
const withArrayStatements = (Base) =>
  class ArrayStatementParser extends Base {
    // Perl: my @name = (...).
    declaration() {
      if (
        this.syntax.id === 'perl' &&
        this.is('@', 1) &&
        this.peek(2).type === 'name'
      ) {
        this.next();
        this.next();
        const variable = this.expectName();
        this.expect('=');
        const value = this.expression();
        this.endStatement();
        return node('Declaration', { name: variable, type: 'array', value });
      }
      return super.declaration();
    }

    // The tokens of a C array declaration: int a[] = ..., int a[n];
    // C++ vectors: std::vector<int> a = ..., std::vector<int> a(n, v);
    arrayDeclarationStart() {
      if (
        this.syntax.id === 'cpp' &&
        ['std', '::', 'vector', '<', 'int', '>'].every((word, index) =>
          this.is(word, index)
        )
      ) {
        return 'vector';
      }
      const c = ['c', 'objc'].includes(this.syntax.family ?? this.syntax.id);
      return c &&
        castTypes.has(this.peek().value) &&
        this.peek(1).type === 'name' &&
        this.is('[', 2)
        ? 'c'
        : undefined;
    }

    // `std::vector<int> a(n, v);` is a declaration, not a prototype.
    announcementLength() {
      return this.arrayDeclarationStart() ? 0 : super.announcementLength();
    }

    isTypedDeclaration() {
      return (
        Boolean(this.arrayDeclarationStart()) || super.isTypedDeclaration()
      );
    }

    typedDeclaration() {
      const start = this.arrayDeclarationStart();
      if (!start) {
        return super.typedDeclaration();
      }
      let value;
      let variable;
      if (start === 'vector') {
        this.position += 6; // std :: vector < int >
        variable = this.expectName();
        if (this.accept('(')) {
          const length = this.expression();
          this.expect(',');
          const fill = this.expression();
          this.expect(')');
          value = node('NewArray', { length, fill });
        } else if (this.is('{')) {
          value = this.arrayPrimary();
        } else {
          value = node('ArrayLiteral', { elements: [] });
        }
      } else {
        this.next();
        variable = this.expectName();
        this.expect('[');
        const length = this.is(']') ? undefined : this.expression();
        this.expect(']');
        // int a[n]; holds no values until a loop fills it.
        value = length && node('NewArray', { length, fill: number(0) });
      }
      if (this.accept('=')) {
        value = this.expression();
      }
      this.endStatement();
      return node('Declaration', { name: variable, type: 'array', value });
    }

    simpleStatement() {
      const store = this.isElementAssignment();
      return store ? this.elementAssignment(store) : super.simpleStatement();
    }

    // name[index] = value, or name(index) = value where parentheses index.
    // Returns the closing symbol of the index.
    isElementAssignment() {
      if (this.peek().type !== 'name') {
        return undefined;
      }
      const [open, close] = parenthesesIndex.has(this.syntax.id)
        ? ['(', ')']
        : ['[', ']'];
      if (!this.is(open, 1)) {
        return undefined;
      }
      let depth = 0;
      for (let index = 1; this.peek(index).type !== 'end'; index += 1) {
        const { value } = this.peek(index);
        depth += value === open ? 1 : value === close ? -1 : 0;
        if (depth === 0) {
          const symbols = [...assignmentSymbols, this.syntax.assignment];
          return symbols.some((symbol) => symbol && this.is(symbol, index + 1))
            ? close
            : undefined;
        }
      }
      return undefined;
    }

    elementAssignment(close) {
      const variable = this.next().value;
      this.next();
      const written = this.expression();
      this.expect(close);
      const index = offset(written, -(this.syntax.arrayBase ?? 0));
      const symbol = this.next().value;
      let value = this.expression();
      const operator = compoundMeanings[symbol];
      if (operator) {
        value = node('Binary', {
          operator,
          left: node('Index', { array: name(variable), index }),
          right: value,
        });
      } else if (symbol !== '=' && symbol !== this.syntax.assignment) {
        throw new SyntaxError(
          `Unsupported element assignment "${symbol}"`,
          this.peek().line
        );
      }
      this.endStatement();
      return node('IndexAssignment', { name: variable, index, value });
    }
  };

export const withArrays = (Base) =>
  withArrayStatements(withArrayExpressions(withArrayConstructors(Base)));
