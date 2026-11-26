import {createTranslator, translateCommentText} from '../js/src/index.js';
const translator = createTranslator();
for (const source of ['Вернуть истину.', 'Вернуть истина.', 'Если делитель не больше числа, сделать это:\n  Вернуть истину.']) {
 console.log(JSON.stringify({source, result:translator.translateFragment(source,'russian','python')}));
}
const source = 'def prime(number):\n    if number < 2:\n        return False\n    return True\n';
console.log(translator.translate(source,'python','russian'));
console.log(translateCommentText('sequence iteratively',{from:'english',to:'russian'}));
