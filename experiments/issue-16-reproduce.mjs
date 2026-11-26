import { createTranslator, formatMeta } from '../js/src/index.js';
const translator = createTranslator();
const cases = [
  ['layout', '// Привет\n\nconsole.log( "Hello World!");\n', 'javascript', 'python', {commentLanguage:'english'}],
  ['power', 'console.log(`${2 ** 10}`);', 'javascript', 'python'],
  ['append', 'const values = [1, 2];\nvalues.push(3);\nconsole.log(values.length);', 'javascript', 'rust'],
  ['question', 'Что такое смысл?', 'russian', 'python'],
  ['exception', 'int main(int argc, char** argv)\n{\n    try { int i=0; throw 8; }\n    catch(int e) { return e; }\n    return 0;\n}', 'cpp', 'python'],
  ['annotation', '@PostMapping\npublic ResponseEntity<UserDto> createUser(\n @RequestBody @Valid CreateUserRequest request) {\n UserDto user = userService.createUser(request);\n return ResponseEntity\n .status(HttpStatus.CREATED)\n .body(user);\n}', 'java', 'python'],
];
for(const [id, source, from, to, options = {}] of cases) {
  try { console.log(JSON.stringify({id, result:translator.translatePartial(source,from,to,{fragment:true,...options})})); }
  catch(error){console.log(JSON.stringify({id, error:error.message}));}
}
for(const text of ['c','hello', 'int main(int argc, char** argv) { try { throw 8; } catch(int e) { return e; } return 0; }']) console.log(JSON.stringify({detection:text,candidates:translator.detectLanguage(text).slice(0,5)}));
console.log(formatMeta(translator.toMeta('while True:\n    if 1 < 2:\n        print(1)\n', 'python')));
