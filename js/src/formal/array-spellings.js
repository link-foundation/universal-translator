// How the shared emitter writes arrays of integers in each language: the
// literal, the array of n equal values, an element, the length, the type
// and, where an array is declared differently from other values (C, C++,
// Perl), the declaration. Languages without a filled array constructor get
// the array and a fill loop from expandArrayFills (arrays.js) instead, and
// languages that count from 1 add 1 to every index here.
//
// C has no array that knows its own length, so an array is a local
// variable-length array (`int a[n];`) whose length is `sizeof a / sizeof
// a[0]`; that is why arrays are only ever local variables.

import { offset } from './arrays.js';

const list = (emitter, elements) =>
  elements.map((element) => emitter.expression(element)).join(', ');

// Each language's spellings. `literal(elements)` and `create(length, fill)`
// receive written code; `length(array)` receives the written array name and
// returns code that binds like a unary operation or tighter, unless
// `loose` says it needs parentheses as an operand.
const spellings = {
  javascript: {
    literal: (elements) => `[${elements}]`,
    create: (length, fill) => `new Array(${length}).fill(${fill})`,
    length: (array) => `${array}.length`,
  },
  gml: {
    literal: (elements) => `[${elements}]`,
    create: (length, fill) => `array_create(${length}, ${fill})`,
    length: (array) => `array_length(${array})`,
  },
  python: {
    literal: (elements) => `[${elements}]`,
    create: (length, fill) => `[${fill}] * ${length}`,
    createParent: 7,
    length: (array) => `len(${array})`,
  },
  ruby: {
    literal: (elements) => `[${elements}]`,
    create: (length, fill) => `Array.new(${length}, ${fill})`,
    length: (array) => `${array}.length`,
  },
  lua: {
    literal: (elements) => `{${elements}}`,
    length: (array) => `#${array}`,
  },
  php: {
    literal: (elements) => `[${elements}]`,
    create: (length, fill) => `array_fill(0, ${length}, ${fill})`,
    length: (array) => `count(${array})`,
  },
  c: {
    literal: (elements) => `{${elements}}`,
    length: (array) => `(int) (sizeof ${array} / sizeof ${array}[0])`,
    loose: true,
  },
  cpp: {
    literal: (elements) => `{${elements}}`,
    length: (array) => `(int) ${array}.size()`,
    loose: true,
  },
  csharp: {
    literal: (elements) => `{${elements}}`,
    create: (length) => `new int[${length}]`,
    length: (array) => `${array}.Length`,
  },
  java: {
    literal: (elements) => `{${elements}}`,
    create: (length) => `new int[${length}]`,
    length: (array) => `${array}.length`,
  },
  go: {
    literal: (elements) => `[]int{${elements}}`,
    create: (length) => `make([]int, ${length})`,
    length: (array) => `len(${array})`,
  },
  rust: {
    literal: (elements) => `vec![${elements}]`,
    create: (length, fill) => `vec![${fill}; ${length} as usize]`,
    lengthParent: 8,
    index: (index) => `${index} as usize`,
    indexParent: 8,
    length: (array) => `${array}.len() as i64`,
    loose: true,
  },
  kotlin: {
    literal: (elements) => `intArrayOf(${elements})`,
    create: (length, fill) => `IntArray(${length}) { ${fill} }`,
    length: (array) => `${array}.size`,
  },
  swift: {
    literal: (elements) => `[${elements}]`,
    create: (length, fill) => `[Int](repeating: ${fill}, count: ${length})`,
    length: (array) => `${array}.count`,
  },
  perl: {
    literal: (elements) => `(${elements})`,
    create: (length, fill) => `(${fill}) x ${length}`,
    createParent: 7,
    length: (array) => `scalar(@${array.slice(1)})`,
  },
  dart: {
    literal: (elements) => `[${elements}]`,
    create: (length, fill) => `List.filled(${length}, ${fill})`,
    length: (array) => `${array}.length`,
  },
  scala: {
    literal: (elements) => `Array(${elements})`,
    create: (length, fill) => `Array.fill(${length}.toInt)(${fill})`,
    lengthParent: 8,
    index: (index) => `${index}.toInt`,
    indexParent: 8,
    open: '(',
    close: ')',
    length: (array) => `${array}.length`,
  },
  julia: {
    literal: (elements) => `[${elements}]`,
    create: (length, fill) => `fill(${fill}, ${length})`,
    length: (array) => `length(${array})`,
  },
  r: {
    literal: (elements) => `c(${elements})`,
    create: (length, fill) => `rep(${fill}, ${length})`,
    length: (array) => `length(${array})`,
  },
  groovy: {
    literal: (elements) => `[${elements}]`,
    create: (length, fill) => `[${fill}] * ${length}`,
    createParent: 7,
    length: (array) => `${array}.size()`,
  },
  nim: {
    literal: (elements) => `@[${elements}]`,
    create: (length, fill) => `newSeqWith(${length}, ${fill})`,
    uses: 'sequtils',
    length: (array) => `${array}.len`,
  },
  d: {
    literal: (elements) => `[${elements}]`,
    create: (length) => `new long[${length}]`,
    length: (array) => `cast(long) ${array}.length`,
    loose: true,
  },
};
spellings.typescript = spellings.javascript;
spellings.pascal = {
  literal: (elements) => `[${elements}]`,
  length: (array) => `Length(${array})`,
};
spellings.vb = {
  literal: (elements) => `{${elements}}`,
  open: '(',
  close: ')',
  length: (array) => `${array}.Length`,
};
// Bash writes array literals as words (dialects/bash.js).
spellings.bash = {
  length: (array) => `\${#${array}[@]}`,
};
spellings.ada = {
  open: ' (',
  close: ')',
  length: (array) => `${array}'Length`,
};
spellings.zig = {
  literal: (elements) => (elements ? `.{ ${elements} }` : '.{}'),
  index: (index) => `@intCast(${index})`,
  length: (array) => `@as(i64, @intCast(${array}.len))`,
};
spellings.fortran = {
  literal: (elements) => `[${elements}]`,
  create: (length, fill) => `spread(${fill}, 1, ${length})`,
  open: '(',
  close: ')',
  length: (array) => `size(${array}, kind=8)`,
};
spellings.matlab = {
  literal: (elements) => `[${elements}]`,
  create: (length, fill) => `repmat(${fill}, 1, ${length})`,
  open: '(',
  close: ')',
  length: (array) => `numel(${array})`,
};

// Spellings that a version of a language changes, by "id@version".
const versionSpellings = {
  // Array.prototype.fill is ES6: the array is created, then filled by a loop.
  'javascript@es5': {
    ...spellings.javascript,
    create: (length) => `new Array(${length})`,
  },
  // The [...] spelling of an array came with PHP 5.4.
  'php@5': {
    ...spellings.php,
    literal: (elements) => `array(${elements})`,
  },
};

// The type of an array where a declaration or signature names it.
const arrayTypes = {
  typescript: 'number[]',
  cpp: 'std::vector<int>',
  csharp: 'int[]',
  java: 'int[]',
  go: '[]int',
  rust: 'Vec<i64>',
  kotlin: 'IntArray',
  swift: '[Int]',
  dart: 'List<int>',
  scala: 'Array[Long]',
  groovy: 'List<Long>',
  nim: 'seq[int]',
  d: 'long[]',
  pascal: 'array of Int64',
  vb: 'Long()',
  lean: 'Array Int',
  rocq: 'list Z',
};

// Languages that declare an array whose elements change like a variable
// that changes: `let mut`, `var`.
const mutableContainers = new Set(['rust', 'swift', 'nim']);

export const withArrays = (Base) =>
  class ArrayEmitter extends Base {
    spelling() {
      return (
        versionSpellings[`${this.id}@${this.syntax.version}`] ??
        spellings[this.syntax.id] ??
        spellings[this.id] ??
        {}
      );
    }

    type(meta) {
      if (meta === 'array' && arrayTypes[this.id]) {
        if (this.id === 'cpp') {
          this.uses.add('vector');
        }
        return arrayTypes[this.id];
      }
      return super.type(meta);
    }

    expression(expression, parent = 0) {
      switch (expression.kind) {
        case 'ArrayLiteral':
          return this.arrayLiteral(expression.elements);
        case 'NewArray':
          return this.newArray(expression, parent);
        case 'Index':
          return this.indexed(expression);
        case 'Length':
          return this.lengthOf(expression, parent);
        default:
          return super.expression(expression, parent);
      }
    }

    arrayLiteral(elements) {
      return this.spelling().literal(list(this, elements));
    }

    newArray({ length, fill }, parent) {
      const spelling = this.spelling();
      if (!spelling.create) {
        throw new Error(`${this.syntax.id} cannot write a filled array`);
      }
      if (spelling.uses) {
        this.uses.add(spelling.uses);
      }
      const result = spelling.create(
        this.expression(
          length,
          spelling.lengthParent ?? spelling.createParent ?? 0
        ),
        this.expression(fill)
      );
      return spelling.createParent && parent > 6 ? `(${result})` : result;
    }

    // The written index of an element: counted from 1 where arrays start
    // at 1.
    writtenIndex(index) {
      const spelling = this.spelling();
      const shifted = offset(index, this.syntax.arrayBase ?? 0);
      const written = this.expression(shifted, spelling.indexParent ?? 0);
      // A number needs no conversion: a[0], not a[0 as usize].
      return spelling.index && shifted.kind !== 'Number'
        ? spelling.index(written)
        : written;
    }

    element(array, index) {
      const { open = '[', close = ']' } = this.spelling();
      return `${this.variable(array)}${open}${this.writtenIndex(index)}${close}`;
    }

    indexed({ array, index }) {
      return this.element(array.name, index);
    }

    lengthOf({ array }, parent) {
      const spelling = this.spelling();
      const result = spelling.length(this.variable(array.name));
      return spelling.loose && parent > 7 ? `(${result})` : result;
    }

    statement(statement) {
      if (statement.kind === 'IndexAssignment') {
        return this.line(this.indexAssignment(statement));
      }
      if (
        statement.kind === 'Declaration' &&
        (statement.type === 'array' ||
          statement.value?.kind === 'ArrayLiteral' ||
          statement.value?.kind === 'NewArray')
      ) {
        return this.line(this.arrayDeclaration(statement));
      }
      return super.statement(statement);
    }

    indexAssignment({ name, index, value }) {
      const operator = this.syntax.assignment ?? '=';
      return `${this.element(name, index)} ${operator} ${this.expression(value)}${this.terminator()}`;
    }

    arrayDeclaration(statement) {
      const { name, value } = statement;
      switch (this.id) {
        case 'c':
          return value.kind === 'NewArray'
            ? `int ${name}[${this.expression(value.length)}];`
            : `int ${name}[] = ${this.expression(value)};`;
        case 'cpp':
          if (value.kind === 'NewArray') {
            this.uses.add('vector');
            return `std::vector<int> ${name}(${this.expression(value.length)}, ${this.expression(value.fill)});`;
          }
          break;
        case 'pascal':
          // SetLength fills the new elements with zeros.
          if (value.kind === 'NewArray') {
            return `SetLength(${name}, ${this.expression(value.length)});`;
          }
          break;
        case 'vb':
          // Dim a(last) As Long: the bound is the last index, and the new
          // elements are zeros.
          if (value.kind === 'NewArray') {
            return `Dim ${name}(${this.expression(offset(value.length, -1))}) As ${this.type('integer')}`;
          }
          break;
        case 'perl':
          return `my @${name} = ${this.expression(value)};`;
        case 'rust':
          return `let ${statement.mutable || statement.elementsAssigned ? 'mut ' : ''}${name}: Vec<i64> = ${this.expression(value)};`;
        default:
          break;
      }
      return this.declaration({
        ...statement,
        type: 'array',
        mutable:
          statement.mutable ||
          (statement.elementsAssigned && mutableContainers.has(this.id)),
      });
    }

    prelude(program) {
      const lines = super.prelude(program);
      const extra = {
        vector: ['#include <vector>', /^#(include|import) /],
        sequtils: ['import std/sequtils', /^import /],
      };
      for (const [use, [line, pattern]] of Object.entries(extra)) {
        if (!this.uses.has(use) || lines.includes(line)) {
          continue;
        }
        const last = lines.findLastIndex((written) => pattern.test(written));
        if (last >= 0) {
          lines.splice(last + 1, 0, line);
        } else {
          lines.unshift(line, '');
        }
      }
      return lines;
    }
  };
