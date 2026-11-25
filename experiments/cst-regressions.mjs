// Show the outputs the CST regression tests pin down.
import { createTranslator } from '../js/src/index.js';
const t = createTranslator();
const tight =
  'def a(n):\n    return n\ndef b(n):\n    return n\n\nprint(a(b(1)))\n';
console.log(JSON.stringify(t.translate(tight, 'python', 'javascript')));
const lead = '# square it\ndef sq(n):\n    return n * n\n\nprint(sq(2))\n';
console.log(JSON.stringify(t.translate(lead, 'python', 'javascript')));
const perl = 'sub one {\n    return 1;\n}\n\nprint(2, "\\n");\n';
const js = t.translate(perl, 'perl', 'javascript');
console.log(JSON.stringify(js));
console.log(JSON.stringify(t.translate(js, 'javascript', 'perl')));
