// How Swift reads and writes print before and after Swift 2, and what a
// version that only renames print.line gives.
import { translate } from '../../js/src/index.js';
import {
  registerLanguageVersion,
  unregisterLanguageVersion,
} from '../../js/src/formal/versions.js';

const program = 'console.log("a");\nprocess.stdout.write("b");\n';
console.log(translate(program, 'javascript', 'swift'));
console.log(
  translate('print("x", terminator: "")\nprintln("y")\n', 'swift', 'javascript')
);
registerLanguageVersion('swift', 'one', {
  syntax: { print: { line: 'println' } },
});
console.log(translate(program, 'javascript', 'swift@one'));
unregisterLanguageVersion('swift', 'one');
