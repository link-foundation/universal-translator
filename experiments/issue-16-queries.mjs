import { createTranslator } from '../js/src/index.js';

const translator = createTranslator();
const cases = [
  ['sql', 'SELECT age + 1 FROM people AS person WHERE age >= 18 AND age < 65;'],
  [
    'csharp',
    'from person in people where person.Age >= 18 select person.Name;',
  ],
  ['python', '[person["name"] for person in people if person["age"] >= 18]'],
  [
    'javascript',
    'people.filter(person => person.age >= 18).map(person => person.name);',
  ],
];
for (const [from, source] of cases) {
  for (const to of ['sql', 'python', 'javascript', 'csharp']) {
    try {
      console.log(
        JSON.stringify({
          from,
          to,
          output: translator.translate(source, from, to),
        })
      );
    } catch (error) {
      console.log(JSON.stringify({ from, to, error: error.message }));
    }
  }
}
