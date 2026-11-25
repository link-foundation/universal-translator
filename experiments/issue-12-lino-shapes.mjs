// How links-notation reads the indented forms considered for rules.
import { parseLinks } from '../js/src/meta/links.js';

const show = (link) =>
  link.values?.length
    ? { id: link.id, values: link.values.map(show) }
    : link.id;
const text = process.argv[2] ?? `rules
  source
    rule
      find colour
      replace color
      language english
  output
    rule
      find 'console.log('
      replace 'print('
      regex true
  templates
    english
      print
        'Say {value}.'
`;
console.log(JSON.stringify(parseLinks(text).map(show), null, 1));
