import {createTranslator} from '../js/src/index.js';
import {parseProgram} from '../js/src/formal/parser.js';
import {languageSyntax} from '../js/src/formal/languages.js';
const translator = createTranslator();
const cases=[['cpp','int main(int argc, char** argv)\n{\n return 0;\n}'],['cpp','int main(int argc, char** argv)\n{\n try { int i=0; throw 8; } catch(int e) { return e; }\n return 0;\n}'],['java','public ResponseEntity<UserDto> createUser(CreateUserRequest request) { UserDto user = userService.createUser(request); return ResponseEntity.status(HttpStatus.CREATED).body(user); }']];
for(const [from,source] of cases){
 for(const phase of ['parse','translate']){
  try{console.log(JSON.stringify({from,source,phase,result:phase==='parse'?parseProgram(source,languageSyntax(from)):translator.translate(source,from,'python')}));}
  catch(error){console.log(JSON.stringify({from,phase,error:error.stack}));}
 }
}
