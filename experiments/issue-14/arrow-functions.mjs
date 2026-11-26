// Arrow functions and static-method classes read as plain functions.
import { createTranslator } from '../../js/src/index.js';

const translator = createTranslator();
export const cases = [
  [
    'javascript',
    'python',
    'const add = (a, b) => a + b;\nconst twice = n => {\n  return n * 2;\n};\nconsole.log(add(2, twice(3)));\n',
  ],
  [
    'typescript',
    'rust',
    'const add = (a: number, b: number): number => a + b;\nconsole.log(add(2, 3));\n',
  ],
  [
    'javascript',
    'python',
    'class Program {\n  static square(n) {\n    return n * n;\n  }\n}\nconsole.log(Program.square(3));\n',
  ],
  [
    'java',
    'csharp',
    'public class Program {\n    static int square(int n) {\n        return n * n;\n    }\n\n    public static void main(String[] args) {\n        System.out.println(Program.square(3));\n    }\n}\n',
  ],
];
for (const [from, to, source] of cases) {
  console.log(`--- ${from} -> ${to}`);
  console.log(translator.translate(source, from, to));
}
