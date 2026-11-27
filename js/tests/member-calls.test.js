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

  it('keeps C++ template arguments and headers alongside ordinary comparisons', () => {
    const source = `#include <algorithm>
#include <iostream>
using namespace std;
int main() {
  max<unsigned>(1, 2);
  lookup<std::vector<unsigned>>(1);
  a < b > (c);
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
    const emitted = translator.translate(source, 'cpp', 'cpp');
    expect(emitted).toContain(
      '#include <algorithm>\n#include <iostream>\nusing namespace std;'
    );
    expect(emitted.match(/#include <iostream>/gu)?.length).toBe(1);
    expect(emitted).toContain('lookup<std::vector<unsigned>>(1);');
    expect(() => translator.translate(source, 'cpp', 'python')).toThrow(
      'C++ template call requires a library mapping for python'
    );
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

describe('C++ library scope and types', () => {
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
