import { describe, expect, it } from 'test-anywhere';
import { createTranslator } from '../src/index.js';

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
});
