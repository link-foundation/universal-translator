import { createTranslator, machineTargetIds } from '../js/src/index.js';

const translator = createTranslator();
const cases = {
  loop: 'let x = 0;\nwhile (x < 2) {\n  console.log(`value = ${x}`);\n  x = x + 1;\n}\n',
  counting: 'for (let i = 0; i < 2; i++) {\n  console.log(i);\n}\n',
  array: 'const values = [1, 2];\nconsole.log(values[1]);\n',
  boolean: 'const flag = 2 < 3;\nif (flag) {\n  console.log(1);\n}\n',
  function:
    'function twice(value) {\n  return value * 2;\n}\nconsole.log(twice(3));\n',
  comment: 'const value = 1;\n// Keep this comment\nconsole.log(value);\n',
};
for (const [name, source] of Object.entries(cases)) {
  const direct = translator.translatePartial(source, 'javascript', 'python', {
    layout: 'target',
  });
  for (const target of machineTargetIds) {
    const machine = translator.translatePartial(source, 'javascript', target, {
      layout: 'target',
    });
    const restored = translator.translatePartial(
      machine.text,
      target,
      'python',
      { layout: 'target' }
    );
    const missing = (machine.lineMap ?? []).filter(([from, instruction]) => {
      const expected = (direct.lineMap ?? [])
        .filter(([line]) => line === from)
        .map(([, line]) => line);
      return !expected.some((to) =>
        (restored.lineMap ?? []).some(
          ([line, mapped]) =>
            line === instruction &&
            restored.text.split('\n')[mapped]?.trim() ===
              direct.text.split('\n')[to]?.trim()
        )
      );
    });
    console.log(
      JSON.stringify({
        name,
        target,
        complete: [machine.complete, restored.complete],
        sameText:
          direct.text.replace(/\n\n/g, '\n') ===
          restored.text.replace(/\n\n/g, '\n'),
        missing,
        direct: direct.text,
        restored: restored.text,
      })
    );
  }
}
