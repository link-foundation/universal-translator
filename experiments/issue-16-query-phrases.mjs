// Reproducible additions to the controlled query grammars. Values are phrase
// rules with expression holes, not translations of particular example queries.
import { readFile, writeFile } from 'node:fs/promises';

const phrases = {
  arabic: [
    'قيم {projection} لكل {variable} في {source} حيث {condition}',
    'ما قيم {projection} لكل {variable} في {source} حيث {condition}',
    'المؤجلة',
  ],
  bengali: [
    '{source} এর প্রতিটি {variable} এর জন্য {condition} হলে {projection} এর মান',
    '{source} এর প্রতিটি {variable} এর জন্য {condition} হলে {projection} এর মান কী',
    'বিলম্বিত',
  ],
  chinese: [
    '对于 {source} 中的每个 {variable} 满足 {condition} 的 {projection} 值',
    '对于 {source} 中的每个 {variable} 满足 {condition} 的 {projection} 值是什么',
    '延迟',
  ],
  dutch: [
    'de waarden van {projection} voor elke {variable} in {source} waarvoor {condition}',
    'Welke waarden van {projection} voor elke {variable} in {source} voldoen aan {condition}',
    'uitgesteld',
  ],
  french: [
    'les valeurs de {projection} pour chaque {variable} dans {source} où {condition}',
    'Quelles valeurs de {projection} pour chaque {variable} dans {source} vérifient {condition}',
    'différé',
  ],
  german: [
    'die Werte von {projection} für jedes {variable} in {source} mit {condition}',
    'Welche Werte von {projection} für jedes {variable} in {source} erfüllen {condition}',
    'verzögert',
  ],
  gujarati: [
    '{source} માં દરેક {variable} માટે {condition} હોય ત્યારે {projection} ના મૂલ્યો',
    '{source} માં દરેક {variable} માટે {condition} હોય ત્યારે {projection} ના મૂલ્યો કયા છે',
    'વિલંબિત',
  ],
  hausa: [
    'ƙimomin {projection} ga kowane {variable} a cikin {source} idan {condition}',
    'Waɗanne ƙimomin {projection} ga kowane {variable} a cikin {source} idan {condition}',
    'jinkiri',
  ],
  hindi: [
    '{source} में हर {variable} के लिए {condition} होने पर {projection} के मान',
    '{source} में हर {variable} के लिए {condition} होने पर {projection} के मान क्या हैं',
    'विलंबित',
  ],
  indonesian: [
    'nilai {projection} untuk setiap {variable} dalam {source} dengan {condition}',
    'Apa nilai {projection} untuk setiap {variable} dalam {source} dengan {condition}',
    'tertunda',
  ],
  italian: [
    'i valori di {projection} per ogni {variable} in {source} dove {condition}',
    'Quali valori di {projection} per ogni {variable} in {source} soddisfano {condition}',
    'differito',
  ],
  japanese: [
    '{source} 内の各 {variable} について {condition} を満たす {projection} の値',
    '{source} 内の各 {variable} について {condition} を満たす {projection} の値は何か',
    '遅延',
  ],
  korean: [
    '{source} 의 각 {variable} 에 대해 {condition} 를 만족하는 {projection} 의 값',
    '{source} 의 각 {variable} 에 대해 {condition} 를 만족하는 {projection} 의 값은 무엇인가',
    '지연',
  ],
  marathi: [
    '{source} मधील प्रत्येक {variable} साठी {condition} असल्यास {projection} ची मूल्ये',
    '{source} मधील प्रत्येक {variable} साठी {condition} असल्यास {projection} ची मूल्ये कोणती',
    'विलंबित',
  ],
  persian: [
    'مقادیر {projection} برای هر {variable} در {source} که {condition}',
    'مقادیر {projection} برای هر {variable} در {source} که {condition} چیست',
    'تأخیری',
  ],
  polish: [
    'wartości {projection} dla każdego {variable} w {source} gdy {condition}',
    'Jakie wartości {projection} dla każdego {variable} w {source} spełniają {condition}',
    'odroczone',
  ],
  portuguese: [
    'os valores de {projection} para cada {variable} em {source} onde {condition}',
    'Quais valores de {projection} para cada {variable} em {source} satisfazem {condition}',
    'adiado',
  ],
  punjabi: [
    '{source} ਵਿੱਚ ਹਰ {variable} ਲਈ {condition} ਹੋਣ ਤੇ {projection} ਦੇ ਮੁੱਲ',
    '{source} ਵਿੱਚ ਹਰ {variable} ਲਈ {condition} ਹੋਣ ਤੇ {projection} ਦੇ ਮੁੱਲ ਕਿਹੜੇ ਹਨ',
    'ਮੁਲਤਵੀ',
  ],
  russian: [
    'значения {projection} для каждого {variable} в {source} при {condition}',
    'Какие значения {projection} для каждого {variable} в {source} удовлетворяют {condition}',
    'отложенно',
  ],
  spanish: [
    'los valores de {projection} para cada {variable} en {source} donde {condition}',
    'Qué valores de {projection} para cada {variable} en {source} cumplen {condition}',
    'diferido',
  ],
  swahili: [
    'thamani za {projection} kwa kila {variable} katika {source} ikiwa {condition}',
    'Ni thamani zipi za {projection} kwa kila {variable} katika {source} ikiwa {condition}',
    'iliyoahirishwa',
  ],
  tagalog: [
    'mga halaga ng {projection} para sa bawat {variable} sa {source} kung {condition}',
    'Anong mga halaga ng {projection} para sa bawat {variable} sa {source} kung {condition}',
    'ipinagpaliban',
  ],
  tamil: [
    '{source} இல் ஒவ்வொரு {variable} க்கும் {condition} எனில் {projection} இன் மதிப்புகள்',
    '{source} இல் ஒவ்வொரு {variable} க்கும் {condition} எனில் {projection} இன் மதிப்புகள் என்ன',
    'ஒத்திவைக்கப்பட்ட',
  ],
  telugu: [
    '{source} లో ప్రతి {variable} కోసం {condition} అయితే {projection} యొక్క విలువలు',
    '{source} లో ప్రతి {variable} కోసం {condition} అయితే {projection} యొక్క విలువలు ఏమిటి',
    'వాయిదా',
  ],
  thai: [
    'ค่าของ {projection} สำหรับแต่ละ {variable} ใน {source} เมื่อ {condition}',
    'ค่าของ {projection} สำหรับแต่ละ {variable} ใน {source} เมื่อ {condition} คืออะไร',
    'เลื่อนออกไป',
  ],
  turkish: [
    '{source} içindeki her {variable} için {condition} olduğunda {projection} değerleri',
    '{source} içindeki her {variable} için {condition} olduğunda {projection} değerleri nelerdir',
    'ertelenmiş',
  ],
  ukrainian: [
    'значення {projection} для кожного {variable} у {source} за умови {condition}',
    'Які значення {projection} для кожного {variable} у {source} задовольняють {condition}',
    'відкладено',
  ],
  urdu: [
    '{source} میں ہر {variable} کے لیے {condition} ہونے پر {projection} کی قدریں',
    '{source} میں ہر {variable} کے لیے {condition} ہونے پر {projection} کی قدریں کیا ہیں',
    'ملتوی',
  ],
  vietnamese: [
    'các giá trị của {projection} cho mỗi {variable} trong {source} khi {condition}',
    'Các giá trị nào của {projection} cho mỗi {variable} trong {source} thỏa mãn {condition}',
    'trì hoãn',
  ],
};

for (const [language, [answer, question, deferred]] of Object.entries(
  phrases
)) {
  const path = `data/natural/${language}.lino`;
  const original = await readFile(path, 'utf8');
  // A separate quoted strategy marker preserves evaluation timing. Its text
  // is localized, and never becomes an identifier or a predicate.
  const quotes = original.match(/ {2}quotes: '([^']+)' '([^']+)'/u);
  const marker = `${quotes[1]}${deferred}${quotes[2]} `;
  const rules = {
    'answer-query': answer,
    'question-query': question,
    'answer-deferred-query': marker + answer,
    'question-deferred-query': marker + question,
  };
  const additions = Object.entries(rules)
    .map(([key, value]) => `    ${key}: '${value.replaceAll("'", "''")}'`)
    .join('\n');
  const clean = original.replace(
    /^ {4}(?:answer|question)-(?:deferred-)?query:.*\n/gmu,
    ''
  );
  await writeFile(
    path,
    clean.replace('  templates:\n', `  templates:\n${additions}\n`)
  );
}
