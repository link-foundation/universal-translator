import { describe, expect, it } from 'test-anywhere';
import { createTranslator } from '../src/index.js';
import { meaningDifference } from '../src/meta/tree.js';

const translator = createTranslator();

describe('member calls on computed receivers', () => {
  it('keeps the receiver before a member call', () => {
    expect(
      translator.translate(
        'factory().first(1).second(2);\n',
        'javascript',
        'python'
      )
    ).toBe('factory().first(1).second(2)\n');
  });

  it('continues Java fluent calls on the next line', () => {
    expect(
      translator.translate(
        'ResponseEntity\n    .status(HttpStatus.CREATED)\n    .body(user);\n',
        'java',
        'python'
      )
    ).toBe('ResponseEntity.status(HttpStatus.CREATED).body(user)\n');
  });

  it('reads multiline calls back to the same expression', () => {
    const source = 'factory()\n  .first(1)\n  .second(2);\n';
    const result = translator.translate(source, 'javascript', 'python');
    expect(translator.translate(result, 'python', 'javascript')).toBe(
      'factory().first(1).second(2);\n'
    );
  });

  it('keeps standalone C++ member and namespace calls beside prototypes', () => {
    const source = `
      int helper(int value);
      int main() {
        values.push(1);
        values.pop();
        std::puts("kept");
        return 0;
      }
    `;
    const program = translator.toMeta(source, 'cpp');
    expect(program.functions).toEqual([]);
    expect(
      program.main.statements.map(({ expression }) => expression.callee)
    ).toEqual(['values.push', 'values.pop', 'std::puts']);
    const emitted = translator.fromMeta(program, 'cpp');
    expect(emitted).toContain('values.push(1);');
    expect(emitted).toContain('values.pop();');
    expect(emitted).toContain('std::puts("kept");');
  });

  it('keeps the type and default construction of a C++ template object', () => {
    const source = `#include <optional>
int main() {
  std::optional<std::optional<unsigned>> empty;
  std::optional<unsigned> count = 7;
  return 0;
}
`;
    const { main } = translator.toMeta(source, 'cpp');
    expect(main.statements[0].value).toBe(undefined);
    expect(main.statements[0].type).toContain('unsigned');
    const emitted = translator.translate(source, 'cpp', 'cpp');
    expect(emitted).toContain('std::optional<std::optional<unsigned>> empty;');
    expect(emitted).toContain('std::optional<unsigned> count = 7;');
    expect(() => translator.translate(source, 'cpp', 'python')).toThrow(
      'C++ template type requires a library mapping for python'
    );
  });

  it('keeps C++ file-scope initialization and its dependencies in source order', () => {
    const source = `int later();
int earlier() { return 7; }
// Shared by the two calls from main.
int shared_value = earlier() + later();
int later() { return 2; }
int advance() { shared_value += 1; return shared_value; }
int main() { return advance() + advance(); }
`;
    const emitted = translator.translate(source, 'cpp', 'cpp');
    let previous = -1;
    for (const section of [
      'int later();',
      'int earlier() {',
      '// Shared by the two calls from main.\nint shared_value = earlier() + later();',
      'int later() {',
      'int advance() {',
      'int main() {',
    ]) {
      const current = emitted.indexOf(section);
      expect(current > previous).toBe(true);
      previous = current;
    }
    expect(
      meaningDifference(
        translator.toMeta(source, 'cpp'),
        translator.toMeta(emitted, 'cpp')
      )
    ).toBe(undefined);
  });

  it('retains empty and list-initialized C++ vectors with their element types', () => {
    const source = `#include <vector>
int main() {
  std::vector<int> empty;
  std::vector<int> list{3, 4};
  std::vector<unsigned> wide;
  return 0;
}
`;
    const emitted = translator.translate(source, 'cpp', 'cpp');
    expect(emitted.match(/#include <vector>/gu)?.length).toBe(1);
    expect(emitted).toContain('std::vector<int> empty = {};');
    expect(emitted).toContain('std::vector<int> list = {3, 4};');
    expect(emitted).toContain('std::vector<unsigned> wide;');
    expect(
      meaningDifference(
        translator.toMeta(source, 'cpp'),
        translator.toMeta(emitted, 'cpp')
      )
    ).toBe(undefined);
  });
});

describe('C++ template calls', () => {
  it('keeps C++ template arguments and headers alongside ordinary comparisons', () => {
    const source = `#include <algorithm>
#include <iostream>
using namespace std;
int main() {
  max<unsigned>(1, 2);
  lookup<std::vector<unsigned>>(1);
  a < b > (c);
  a < 1 > (c);
  std::get<
    1
  >(values);
  std::cout << 1 << std::endl;
  return 0;
}
`;
    const { main } = translator.toMeta(source, 'cpp');
    const { kind, callee, typeArguments } = main.statements[0].expression;
    expect([kind, callee, typeArguments]).toEqual([
      'CppTemplateCall',
      'max',
      'unsigned',
    ]);
    expect(main.statements[1].expression.kind).toBe('CppTemplateCall');
    expect(main.statements[2].expression.kind).toBe('Binary');
    expect(main.statements[3].expression.kind).toBe('Binary');
    const indexed = main.statements[4].expression;
    expect([indexed.kind, indexed.callee, indexed.typeArguments]).toEqual([
      'CppTemplateCall',
      'std::get',
      '1',
    ]);
    const emitted = translator.translate(source, 'cpp', 'cpp');
    expect(emitted).toContain(
      '#include <algorithm>\n#include <iostream>\nusing namespace std;'
    );
    expect(emitted.match(/#include <iostream>/gu)?.length).toBe(1);
    expect(emitted).toContain('lookup<std::vector<unsigned>>(1);');
    expect(emitted).toContain('std::get<1>(values);');
    expect(() => translator.translate(source, 'cpp', 'python')).toThrow(
      'C++ template call requires a library mapping for python'
    );
  });
});

describe('C++ parameter types', () => {
  it('keeps the signedness and width of native function parameters', () => {
    const source = `bool positive(unsigned int wide, signed char byte, long long large, short small) {
  return wide > 0 && byte > 0 && large > 0 && small > 0;
}
`;
    const emitted = translator.translate(source, 'cpp', 'cpp');
    expect(emitted).toContain(
      'bool positive(unsigned int wide, signed char byte, long long large, short small)'
    );
    expect(
      meaningDifference(
        translator.toMeta(source, 'cpp'),
        translator.toMeta(emitted, 'cpp')
      )
    ).toBe(undefined);
  });
});

describe('C++ parenthesized object initialization', () => {
  it('distinguishes bound values, template constructors and function declarations', () => {
    const source = `#include <optional>
#include <string>
void example(int width) {
  std::optional<int> result(width);
}
int main() {
  std::string original = "layout";
  std::string copy(original);
  std::string prototype(std::string);
  int count = 1;
  int limit = 2;
  count < limit > probe(count);
  return 0;
}
`;
    const program = translator.toMeta(source, 'cpp');
    const initial = program.functions[0].body.statements[0].value;
    const [, copy, , , comparison] = program.main.statements;
    expect(initial.kind).toBe('CppDirectInitializer');
    expect(initial.arguments[0].name).toBe('width');
    expect(copy.value.kind).toBe('CppDirectInitializer');
    expect(copy.value.arguments[0].name).toBe('original');
    expect(comparison.expression.operator).toBe('greater');
    const emitted = translator.translate(source, 'cpp', 'cpp');
    expect(emitted).toContain('std::optional<int> result(width);');
    expect(emitted).toContain('std::string copy(original);');
    expect(translator.toMeta(emitted, 'cpp').main.statements).toEqual(
      program.main.statements
    );
  });

  it('retains literal and member-call constructor arguments beside prototypes', () => {
    const source = String.raw`#include <iostream>
#include <string_view>
std::string_view factory(int size = 3);
const std::string_view message(
  "ready)"
);
int main() {
  std::string_view deferred();
  std::string_view suffix(message.substr(1));
  std::string_view escaped("\\x61");
  int count(2);
  count * estimate(1);
  std::cout << suffix << escaped << '\\n';
  return 0;
}
`;
    const program = translator.toMeta(source, 'cpp');
    const [message, suffix, escaped, count, estimate] = program.main.statements;
    expect([
      message.name,
      suffix.name,
      suffix.value.kind,
      escaped.name,
    ]).toEqual(['message', 'suffix', 'CppDirectInitializer', 'escaped']);
    const emitted = translator.translate(source, 'cpp', 'cpp');
    expect(emitted).toContain('const std::string_view message("ready)");');
    expect(emitted).toContain('std::string_view suffix(message.substr(1));');
    expect(emitted).toContain(String.raw`std::string_view escaped("\\x61");`);
    expect(count.value.arguments[0].value).toBe(2);
    expect(emitted).toContain('int count(2);');
    expect(estimate.expression.operator).toBe('multiply');
    expect(translator.toMeta(emitted, 'cpp').main.statements).toEqual(
      program.main.statements
    );
    expect(() => translator.translate(source, 'cpp', 'python')).toThrow(
      'C++ direct initialization requires a library mapping for python'
    );
  });
});

describe('C++ fixed arrays', () => {
  it('retains nested extents and direct and copy brace initialization', () => {
    const source = `int main() {
      const std::array<std::string, 3> fallFruit {"pear", "apple",};
      std::array<std::array<int, 2>, 2> numbers = {{{1, 2}, {3, 4}}};
      fallFruit.size();
      a < 3 > b;
      return 0;
    }`;
    const program = translator.toMeta(source, 'cpp');
    const [fruit, numbers, size, comparison] = program.main.statements;
    expect(fruit.value.kind).toBe('CppInitializerList');
    expect(fruit.value.direct).toBe(true);
    expect(numbers.value.direct).toBe(false);
    expect(size.expression.callee).toBe('.size');
    expect(comparison.expression.kind).toBe('Binary');
    const emitted = translator.translate(source, 'cpp', 'cpp');
    expect(emitted).toContain(
      'const std::array<std::string,3> fall_fruit{"pear", "apple"};'
    );
    expect(emitted).toContain(
      'std::array<std::array<int,2>,2> numbers = {{{1, 2}, {3, 4}}};'
    );
    expect(emitted).toContain('fall_fruit.size();');
    expect(emitted).not.toContain('(int) fall_fruit.size()');
    expect(meaningDifference(program, translator.toMeta(emitted, 'cpp'))).toBe(
      undefined
    );
    expect(() => translator.translate(source, 'cpp', 'python')).toThrow(
      'C++ template type requires a library mapping for python'
    );
  });
});

describe('C++ arithmetic and string addition', () => {
  it('binds C++ shifts below addition and retains nested shift operands', () => {
    const source = `#include <iostream>
int main() {
  std::cout << 2 + 3 << " " << (32 >> 1 + 1) << std::endl;
  return 0;
}`;
    const meta = translator.toMeta(source, 'cpp');
    const output = meta.main.statements[0];
    expect(output.kind).toBe('Print');
    expect(output.value.parts[0].operator).toBe('add');
    expect(output.value.parts[2].operator).toBe('rightShift');
    expect(output.value.parts[2].right.operator).toBe('add');
    const emitted = translator.translate(source, 'cpp', 'cpp');
    expect(emitted).toContain('std::cout << (2 + 3) << " "');
    expect(emitted).toContain('32 >> (1 + 1)');
    expect(meaningDifference(meta, translator.toMeta(emitted, 'cpp'))).toBe(
      undefined
    );
    expect(() => translator.translate(source, 'cpp', 'python')).toThrow(
      'C++ shift or stream operator requires a mapping'
    );
  });

  it('keeps indexed characters and character literals in C++ string addition', () => {
    const source = `#include <string>
std::string decorate(const std::string& prefix, std::string word) {
  return prefix[0] + word + '!';
}
`;
    const meta = translator.toMeta(source, 'cpp');
    const value = meta.functions[0].body.statements[0].value;
    expect(value.kind).toBe('CppCharacterConcat');
    expect(value.left.left.kind).toBe('Index');
    expect(value.right.kind).toBe('CppCharacter');
    const emitted = translator.translate(source, 'cpp', 'cpp');
    expect(emitted).toContain("return prefix[0] + word + '!';");
    expect(meaningDifference(meta, translator.toMeta(emitted, 'cpp'))).toBe(
      undefined
    );
    expect(() => translator.translate(source, 'cpp', 'python')).toThrow(
      'Cannot emit CppCharacterConcat as an expression'
    );
  });
});

describe('C++ stream extraction and exceptions', () => {
  it('keeps the stream operation and a thrown object before their uses', () => {
    const source = `#include <iostream>
#include <stdexcept>
#include <string>
using std::string;
int main() {
  string label;
  int count = 0;
  std::cin >> label >> count;
  if (count == 0) {
    throw std::invalid_argument(label);
  }
  std::cout << label << count;
  return 0;
}
`;
    const program = translator.toMeta(source, 'cpp');
    const [label, , extraction, guard] = program.main.statements;
    expect(label.value?.value).toBe('');
    expect(extraction.expression?.operator).toBe('rightShift');
    expect(guard.then.statements[0].kind).toBe('Throw');
    const emitted = translator.translate(source, 'cpp', 'cpp');
    expect(emitted).toContain('std::string label = "";');
    expect(emitted).toContain('std::cin >> label >> count;');
    expect(emitted).toContain('throw std::invalid_argument(label);');
  });
});

describe('C++ library scope and types', () => {
  it('keeps character literals, escapes, and explicit character casts', () => {
    const source = String.raw`int main() {
      emit((int)'\n', (char)97, (int)(char)(64 + 1), sizeof(char), sizeof('a'));
    }`;
    const meta = translator.toMeta(source, 'cpp');
    const [statement] = meta.main.statements;
    const [code, letter, nested, typeWidth, literalWidth] =
      statement.expression.arguments;
    expect(code).toEqual({
      kind: 'CppIntegralCast',
      castType: 'int',
      operand: { kind: 'CppCharacter', raw: String.raw`\n` },
    });
    expect(letter.castType).toBe('char');
    expect(nested.operand.castType).toBe('char');
    expect(typeWidth.operand.name).toBe('char');
    expect(literalWidth.operand.kind).toBe('CppCharacter');
    const emitted = translator.translate(source, 'cpp', 'cpp');
    expect(emitted).toContain(String.raw`(int)('\n')`);
    expect(meaningDifference(meta, translator.toMeta(emitted, 'cpp'))).toBe(
      undefined
    );
  });

  it('keeps sizeof operands unevaluated and retains qualified string types', () => {
    const source = `#include <string>
using std::string;
int main() {
  string s = "水a";
  string::size_type bytes = s.size() * sizeof(string::value_type);
  std::size_t integerWidth = sizeof(int);
  std::size_t callWidth = sizeof(next());
}`;
    const program = translator.toMeta(source, 'cpp');
    const [, bytes, integerWidth, callWidth] = program.main.statements;
    expect(bytes.type).toBe('source:string :: size_type');
    expect(bytes.value.right.kind).toBe('SizeOf');
    expect(integerWidth.value.operand.name).toBe('int');
    expect(callWidth.value.operand.callee).toBe('next');
    const emitted = translator.translate(source, 'cpp', 'cpp');
    expect(emitted).toContain(
      'string::size_type bytes = s.size() * sizeof(string::value_type);'
    );
    expect(emitted).toContain('std::size_t integer_width = sizeof(int);');
    expect(emitted).toContain('std::size_t call_width = sizeof(next());');
    expect(meaningDifference(program, translator.toMeta(emitted, 'cpp'))).toBe(
      undefined
    );
  });

  it('reads direct string initialization alongside C++ function prototypes', () => {
    const source = String.raw`#include <string>
std::string empty();
std::string suggest(const char* text);
std::string repeat(int, char);
int main() {
  std::string greeting(
    "Hello\0ignored"
  );
  std::string suffix;
  int copies = 3;
  std::string repeated(copies,
    '\0'
  );
  greeting.append(" , world!");
  return 0;
}
`;
    const program = translator.toMeta(source, 'cpp');
    expect(program.functions).toEqual([]);
    const { kind, name, type, value } = program.main.statements[0];
    expect([kind, name, type, value.kind, value.value]).toEqual([
      'Declaration',
      'greeting',
      'text',
      'Text',
      'Hello',
    ]);
    const emitted = translator.translate(source, 'cpp', 'cpp');
    expect(emitted).toContain('std::string greeting = "Hello";');
    expect(emitted).toContain('std::string suffix = "";');
    expect(program.main.statements[1].value).toEqual({
      kind: 'Text',
      value: '',
      type: 'text',
    });
    const repeated = program.main.statements[3];
    expect(repeated.name).toBe('repeated');
    expect(repeated.value.callee).toBe('std::string');
    expect(repeated.value.arguments[0].name).toBe('copies');
    expect(repeated.value.arguments[1].kind).toBe('CppCharacter');
    expect(repeated.value.arguments[1].raw).toBe('\\0');
    expect(emitted).toContain(
      "std::string repeated = std::string(copies, '\\0');"
    );
    expect(emitted).toContain('greeting.append(" , world!");');
    expect(translator.toMeta(emitted, 'cpp').main.statements).toEqual(
      program.main.statements
    );
    expect(() =>
      translator.toMeta(String.raw`std::string greeting("\07");`, 'cpp')
    ).toThrow('Unsupported C++ string initializer escape');
  });

  it('keeps C++ using directives and declarations in their original blocks', () => {
    const source = `#include <iostream>
int main() {
  using namespace std;
  if (true) {
    using std::flush;
    cout << 3 << flush;
  }
  return 0;
}
`;
    const emitted = translator.translate(source, 'cpp', 'cpp');
    expect(emitted).toMatch(
      /int main\(\) \{\n +using namespace std;\n +if \(true\) \{\n +using std::flush;/u
    );
    expect(() => translator.translate(source, 'cpp', 'python')).toThrow(
      'Cannot emit Import as a statement'
    );
  });

  it('retains const on C++ reference and pointer parameters', () => {
    const source = `#include <string>
int example(const std::string& phrase, const char* suffix) {
  return phrase.find(suffix);
}
int main() { return example("abc", "bc"); }
`;
    const meta = translator.toMeta(source, 'cpp');
    expect(meta.functions[0].parameters.map(({ type }) => type)).toEqual([
      'source:std :: string &',
      'text',
    ]);
    const emitted = translator.translate(source, 'cpp', 'cpp');
    expect(emitted).toMatch(/const std::string\s*&\s*phrase/u);
    expect(emitted).toMatch(/const char\s*\*\s*suffix/u);
    expect(meaningDifference(meta, translator.toMeta(emitted, 'cpp'))).toBe(
      undefined
    );
  });
});
