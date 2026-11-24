# One-time seed: writes data/natural/<id>.lino for the controlled languages
# from compact tables. The .lino files are the source of truth afterwards;
# edit them directly. Kept for reference (python3 experiments/seed-natural-languages.py).
import sys

KEYS = """function function-without-parameters declare assign print-line print
return-value return nothing evaluate if else-if else while for call
call-without-arguments join or and not negate equal not-equal less
less-or-equal greater greater-or-equal add subtract multiply divide
remainder""".split()
WORDS = """ackermann bottles common count current digits disks divisor factorial
fibonacci first greatest hailstone index is leap limit move next number of
previous prime remainder second source spare squares step steps sum target
total year""".split()

def q(value):
    return f'"{value}"' if "'" in value else f"'{value}'"

def write(spec):
    head, templates, words = spec
    templates = [t.strip() for t in templates.strip().split('\n')]
    words = words.split()
    assert len(templates) == len(KEYS), (head['id'], len(templates))
    assert len(words) == len(WORDS), (head['id'], len(words))
    lines = ['natural:']
    for key in ['id', 'label', 'native-label', 'family', 'speakers', 'profile']:
        if key in head:
            lines.append(f'  {key}: {q(head[key])}')
    lines.append(f"  sentence-end: {q(head.get('end', '.'))}")
    lines.append(f"  block-end: {q(head.get('block', ':'))}")
    lines.append(f"  quotes: {q(head['quotes'][0])} {q(head['quotes'][1])}")
    lines.append(f"  list-separator: {q(head.get('separator', ','))}")
    lines.append(f"  list-and: {q(head['and'])}")
    lines.append(f"  true: {q(head['true'])}")
    lines.append(f"  false: {q(head['false'])}")
    lines.append(f"  note: {q(head['note'])}")
    lines.append('  templates:')
    for key, text in zip(KEYS, templates):
        lines.append(f'    {key}: {" ".join(q(t.strip()) for t in text.split(" || "))}')
    lines.append('  words:')
    for neutral, word in zip(WORDS, words):
        lines.append(f'    {neutral}: {q(word)}')
    with open(f"data/natural/{head['id']}.lino", 'w') as out:
        out.write('\n'.join(lines) + '\n')

PAREN_CALL = '{callee} ({arguments})\n{callee} ( )'

LANGUAGES = [
({'id': 'chinese', 'label': 'Chinese (Mandarin)', 'native-label': '中文', 'family': 'Sino-Tibetan', 'speakers': '1.2 billion',
  'end': '。', 'block': '：', 'quotes': '“”', 'separator': '，', 'and': '和', 'true': '真', 'false': '假', 'note': '注：{text}'}, """
定义 {name} 使用 {parameters}
定义 {name}
创建 {name} 值 为 {value}
把 {name} 改 为 {value}
输出 {value} 并 换行
输出 {value}
返回 {value}
在 此 停止
什么 也 不 做
执行 {expression}
如果 {condition} 就 做 这些
否则 如果 {condition} 就 做 这些
否则 做 这些
当 {condition} 时 重复 这些
对 每个 {variable} 从 {start} 到 {last} 重复 这些
""" + PAREN_CALL + """
{left} 接 {right}
{left} 或 {right}
{left} 并且 {right}
非 {operand}
负 {operand}
{left} 等于 {right}
{left} 不 等于 {right}
{left} 小于 {right}
{left} 不 大于 {right}
{left} 大于 {right}
{left} 不 小于 {right}
{left} 加 {right}
{left} 减 {right}
{left} 乘 {right}
{left} 除以 {right}
{left} 模 {right}
""", "阿克曼 瓶子 公 数量 当前 数字 圆盘 约数 阶乘 斐波那契 第一 最大 冰雹 索引 是否 闰 上限 移动 下一个 数 的 上一个 素数 余数 第二 源 备用 平方 步 步数 总和 目标 合计 年"),
({'id': 'hindi', 'label': 'Hindi', 'native-label': 'हिन्दी', 'family': 'Indo-European', 'speakers': '600 million',
  'end': '।', 'quotes': '“”', 'and': 'और', 'true': 'सत्य', 'false': 'असत्य', 'note': 'टिप्पणी: {text}'}, """
{name} को {parameters} से परिभाषित करें
{name} को परिभाषित करें
{name} को मान {value} के साथ बनाएँ
{name} को {value} में बदलें
{value} लिखें और पंक्ति समाप्त करें
{value} लिखें
{value} लौटाएँ
यहीं रुकें
कुछ न करें
{expression} चलाएँ
यदि {condition} तो यह करें
अन्यथा यदि {condition} तो यह करें
अन्यथा यह करें
जब तक {condition} तब तक यह दोहराएँ
हर {variable} के लिए {start} से {last} तक यह दोहराएँ
""" + PAREN_CALL + """
{left} के बाद {right}
{left} या {right}
{left} और {right}
नहीं {operand}
ऋण {operand}
{left} का मान {right} के बराबर है
{left} का मान {right} के बराबर नहीं है
{left} का मान {right} से कम है
{left} का मान {right} से अधिक नहीं है
{left} का मान {right} से अधिक है
{left} का मान {right} से कम नहीं है
{left} जमा {right}
{left} घटा {right}
{left} गुणा {right}
{left} भाग {right}
{left} मॉड्यूलो {right}
""", "एकरमैन बोतलें उभयनिष्ठ गिनती वर्तमान अंक डिस्कें भाजक क्रमगुणित फिबोनाची पहला महत्तम ओला सूचकांक क्या अधि सीमा खिसकाओ अगला संख्या का पिछला अभाज्य शेष दूसरा स्रोत सहायक वर्गों चरण चरणों योग लक्ष्य कुल वर्ष"),
({'id': 'spanish', 'label': 'Spanish', 'native-label': 'Español', 'family': 'Indo-European', 'speakers': '560 million',
  'quotes': '«»', 'and': 'y', 'true': 'verdadero', 'false': 'falso', 'note': 'Nota: {text}'}, """
Definir {name} usando {parameters}
Definir {name}
Crear {name} con valor {value}
Cambiar {name} a {value}
Escribir {value} y terminar la línea
Escribir {value}
Devolver {value}
Parar aquí
No hacer nada
Ejecutar {expression}
Si {condition}, hacer esto
Si no, si {condition}, hacer esto
Si no, hacer esto
Mientras {condition}, repetir esto
Para cada {variable} desde {start} hasta {last}, repetir esto
{callee} de ({arguments})
{callee} sin argumentos
{left} seguido de {right}
{left} o {right}
{left} y {right}
no {operand}
el opuesto de {operand}
{left} es igual a {right}
{left} es distinto de {right}
{left} es menor que {right}
{left} es como mucho {right}
{left} es mayor que {right}
{left} es como mínimo {right}
{left} más {right}
{left} menos {right}
{left} por {right}
{left} dividido entre {right}
{left} módulo {right}
""", "ackermann botellas común cantidad actual dígitos discos divisor factorial fibonacci primero máximo granizo índice es bisiesto límite mover siguiente número de anterior primo resto segundo origen auxiliar cuadrados paso pasos suma destino total año"),
({'id': 'french', 'label': 'French', 'native-label': 'Français', 'family': 'Indo-European', 'speakers': '310 million',
  'quotes': '«»', 'and': 'et', 'true': 'vrai', 'false': 'faux', 'note': 'Remarque : {text}'}, """
Définir {name} avec {parameters}
Définir {name}
Créer {name} avec la valeur {value}
Changer {name} en {value}
Écrire {value} et finir la ligne
Écrire {value}
Renvoyer {value}
Arrêter ici
Ne rien faire
Exécuter {expression}
Si {condition}, faire ceci
Sinon, si {condition}, faire ceci
Sinon, faire ceci
Tant que {condition}, répéter ceci
Pour chaque {variable} de {start} à {last}, répéter ceci
{callee} de ({arguments})
{callee} sans argument
{left} suivi de {right}
{left} ou {right}
{left} et {right}
non {operand}
l'opposé de {operand}
{left} est égal à {right}
{left} est différent de {right}
{left} est inférieur à {right}
{left} est au plus {right}
{left} est supérieur à {right}
{left} est au moins {right}
{left} plus {right}
{left} moins {right}
{left} fois {right}
{left} divisé par {right}
{left} modulo {right}
""", "ackermann bouteilles commun compte courant chiffres disques diviseur factorielle fibonacci initial maximal grêlon indice est bissextile limite déplacer suivant nombre de précédent premier reste second source auxiliaire carrés pas étapes somme cible total année"),
({'id': 'arabic', 'label': 'Arabic', 'native-label': 'العربية', 'family': 'Afro-Asiatic', 'speakers': '400 million',
  'quotes': '«»', 'separator': '،', 'and': 'و', 'true': 'صحيح', 'false': 'خطأ', 'note': 'ملاحظة: {text}'}, """
عرّف {name} باستخدام {parameters}
عرّف {name}
أنشئ {name} بالقيمة {value}
غيّر {name} إلى {value}
اكتب {value} ثم أنه السطر
اكتب {value}
أعد {value}
توقف هنا
لا تفعل شيئا
نفّذ {expression}
إذا {condition} فافعل هذا
وإلا إذا {condition} فافعل هذا
وإلا فافعل هذا
طالما {condition} فكرر هذا
لكل {variable} من {start} إلى {last} كرر هذا
""" + PAREN_CALL + """
{left} يليه {right}
{left} أو {right}
{left} و {right}
ليس {operand}
سالب {operand}
{left} يساوي {right}
{left} لا يساوي {right}
{left} أصغر من {right}
{left} لا يتجاوز {right}
{left} أكبر من {right}
{left} لا يقل عن {right}
{left} زائد {right}
{left} ناقص {right}
{left} مضروبا في {right}
{left} مقسوما على {right}
{left} بمقياس {right}
""", "أكرمان زجاجات مشترك تعداد حالي أرقام أقراص قاسم مضروب فيبوناتشي أول أعظم برد فهرس هل كبيس حد انقل تالي عدد من سابق أولي باقي ثاني مصدر احتياطي مربعات خطوة خطوات مجموع هدف إجمالي سنة"),
({'id': 'bengali', 'label': 'Bengali', 'native-label': 'বাংলা', 'family': 'Indo-European', 'speakers': '270 million',
  'end': '।', 'quotes': '“”', 'and': 'ও', 'true': 'সত্য', 'false': 'মিথ্যা', 'note': 'টীকা: {text}'}, """
{name} কে {parameters} দিয়ে সংজ্ঞায়িত করো
{name} কে সংজ্ঞায়িত করো
{name} তৈরি করো মান {value} দিয়ে
{name} কে {value} তে বদলাও
{value} লেখো এবং লাইন শেষ করো
{value} লেখো
{value} ফেরত দাও
এখানে থামো
কিছুই কোরো না
{expression} চালাও
যদি {condition} হয় তবে এটি করো
নইলে যদি {condition} হয় তবে এটি করো
নইলে এটি করো
যতক্ষণ {condition} ততক্ষণ এটি পুনরাবৃত্তি করো
প্রতিটি {variable} এর জন্য {start} থেকে {last} পর্যন্ত এটি পুনরাবৃত্তি করো
""" + PAREN_CALL + """
{left} এর পরে {right}
{left} অথবা {right}
{left} এবং {right}
না {operand}
ঋণাত্মক {operand}
{left} এর মান {right} এর সমান
{left} এর মান {right} এর সমান নয়
{left} এর মান {right} এর চেয়ে কম
{left} এর মান {right} এর চেয়ে বেশি নয়
{left} এর মান {right} এর চেয়ে বেশি
{left} এর মান {right} এর চেয়ে কম নয়
{left} যোগ {right}
{left} বিয়োগ {right}
{left} গুণ {right}
{left} ভাগ {right}
{left} মডুলো {right}
""", "আকারম্যান বোতল সাধারণ গণনা বর্তমান অঙ্ক চাকতি ভাজক ফ্যাক্টোরিয়াল ফিবোনাচি প্রথম বৃহত্তম শিলা সূচক কি অধি সীমা সরাও পরবর্তী সংখ্যা এর পূর্ববর্তী মৌলিক ভাগশেষ দ্বিতীয় উৎস অতিরিক্ত বর্গ ধাপ ধাপগুলি যোগফল লক্ষ্য মোট বছর"),
({'id': 'portuguese', 'label': 'Portuguese', 'native-label': 'Português', 'family': 'Indo-European', 'speakers': '260 million',
  'quotes': '“”', 'and': 'e', 'true': 'verdadeiro', 'false': 'falso', 'note': 'Nota: {text}'}, """
Definir {name} usando {parameters}
Definir {name}
Criar {name} com valor {value}
Mudar {name} para {value}
Escrever {value} e terminar a linha
Escrever {value}
Devolver {value}
Parar aqui
Não fazer nada
Executar {expression}
Se {condition}, fazer isto
Senão, se {condition}, fazer isto
Senão, fazer isto
Enquanto {condition}, repetir isto
Para cada {variable} de {start} até {last}, repetir isto
{callee} de ({arguments})
{callee} sem argumentos
{left} seguido de {right}
{left} ou {right}
{left} e {right}
não {operand}
o oposto de {operand}
{left} é igual a {right}
{left} é diferente de {right}
{left} é menor que {right}
{left} é no máximo {right}
{left} é maior que {right}
{left} é no mínimo {right}
{left} mais {right}
{left} menos {right}
{left} vezes {right}
{left} dividido por {right}
{left} módulo {right}
""", "ackermann garrafas comum contagem atual dígitos discos divisor fatorial fibonacci primeiro maior granizo índice é bissexto limite mover próximo número de anterior primo resto segundo origem auxiliar quadrados passo passos soma destino total ano"),
({'id': 'russian', 'label': 'Russian', 'native-label': 'Русский', 'family': 'Indo-European', 'speakers': '255 million',
  'quotes': '«»', 'and': 'и', 'true': 'истина', 'false': 'ложь', 'note': 'Примечание: {text}'}, """
Определить {name} через {parameters}
Определить {name}
Создать {name} со значением {value}
Изменить {name} на {value}
Написать {value} и закончить строку
Написать {value}
Вернуть {value}
Остановиться здесь
Ничего не делать
Выполнить {expression}
Если {condition}, сделать это
Иначе, если {condition}, сделать это
Иначе сделать это
Пока {condition}, повторять это
Для каждого {variable} от {start} до {last} повторять это
{callee} от ({arguments})
{callee} без аргументов
{left} затем {right}
{left} или {right}
{left} и {right}
не {operand}
противоположное {operand}
{left} равно {right}
{left} не равно {right}
{left} меньше {right}
{left} не больше {right}
{left} больше {right}
{left} не меньше {right}
{left} плюс {right}
{left} минус {right}
{left} умножить на {right}
{left} разделить на {right}
{left} по модулю {right}
""", "аккерман бутылки общий количество текущий цифры диски делитель факториал фибоначчи первый наибольший градина индекс является високосный предел переместить следующий число из предыдущий простое остаток второй источник запасной квадраты шаг шаги сумма цель итог год"),
({'id': 'urdu', 'label': 'Urdu', 'native-label': 'اردو', 'family': 'Indo-European', 'speakers': '230 million',
  'end': '۔', 'quotes': '“”', 'separator': '،', 'and': 'اور', 'true': 'سچ', 'false': 'جھوٹ', 'note': 'نوٹ: {text}'}, """
{name} کو {parameters} سے متعین کریں
{name} کو متعین کریں
{name} کو قدر {value} کے ساتھ بنائیں
{name} کو {value} میں بدلیں
{value} لکھیں اور سطر ختم کریں
{value} لکھیں
{value} واپس کریں
یہیں رکیں
کچھ نہ کریں
{expression} چلائیں
اگر {condition} تو یہ کریں
ورنہ اگر {condition} تو یہ کریں
ورنہ یہ کریں
جب تک {condition} تب تک یہ دہرائیں
ہر {variable} کے لیے {start} سے {last} تک یہ دہرائیں
""" + PAREN_CALL + """
{left} کے بعد {right}
{left} یا {right}
{left} اور {right}
نہیں {operand}
منفی {operand}
{left} کی قدر {right} کے برابر ہے
{left} کی قدر {right} کے برابر نہیں ہے
{left} کی قدر {right} سے کم ہے
{left} کی قدر {right} سے زیادہ نہیں ہے
{left} کی قدر {right} سے زیادہ ہے
{left} کی قدر {right} سے کم نہیں ہے
{left} جمع {right}
{left} تفریق {right}
{left} ضرب {right}
{left} تقسیم {right}
{left} ماڈیولو {right}
""", "ایکرمین بوتلیں مشترک گنتی موجودہ ہندسے طشتریاں قاسم فیکٹوریل فبوناچی پہلا عظیم اولا اشاریہ کیا لیپ حد منتقل اگلا عدد کا پچھلا مفرد باقی دوسرا ماخذ فالتو مربعے قدم اقدام مجموعہ ہدف میزان سال"),
({'id': 'indonesian', 'label': 'Indonesian', 'native-label': 'Bahasa Indonesia', 'family': 'Austronesian', 'speakers': '200 million',
  'quotes': '“”', 'and': 'dan', 'true': 'benar', 'false': 'salah', 'note': 'Catatan: {text}'}, """
Definisikan {name} dengan {parameters}
Definisikan {name}
Buat {name} dengan nilai {value}
Ubah {name} menjadi {value}
Tulis {value} dan akhiri baris
Tulis {value}
Kembalikan {value}
Berhenti di sini
Tidak melakukan apa pun
Jalankan {expression}
Jika {condition}, lakukan ini
Selain itu, jika {condition}, lakukan ini
Selain itu, lakukan ini
Selama {condition}, ulangi ini
Untuk setiap {variable} dari {start} sampai {last}, ulangi ini
{callee} dari ({arguments})
{callee} tanpa argumen
{left} diikuti {right}
{left} atau {right}
{left} dan {right}
tidak {operand}
negatif {operand}
{left} sama dengan {right}
{left} tidak sama dengan {right}
{left} kurang dari {right}
{left} paling banyak {right}
{left} lebih dari {right}
{left} paling sedikit {right}
{left} ditambah {right}
{left} dikurangi {right}
{left} dikali {right}
{left} dibagi {right}
{left} modulo {right}
""", "ackermann botol bersama hitungan sekarang digit cakram pembagi faktorial fibonacci pertama terbesar hujanes indeks apakah kabisat batas pindahkan berikutnya bilangan dari sebelumnya prima sisa kedua asal cadangan kuadrat langkah tahapan jumlah tujuan total tahun"),
({'id': 'german', 'label': 'German', 'native-label': 'Deutsch', 'family': 'Indo-European', 'speakers': '135 million',
  'quotes': '„“', 'and': 'und', 'true': 'wahr', 'false': 'falsch', 'note': 'Hinweis: {text}'}, """
Definiere {name} mit {parameters}
Definiere {name}
Erzeuge {name} mit dem Wert {value}
Ändere {name} auf {value}
Schreibe {value} und beende die Zeile
Schreibe {value}
Gib {value} zurück
Höre hier auf
Tue nichts
Führe {expression} aus
Wenn {condition}, tue dies
Sonst, wenn {condition}, tue dies
Sonst tue dies
Solange {condition}, wiederhole dies
Für jedes {variable} von {start} bis {last} wiederhole dies
{callee} von ({arguments})
{callee} ohne Argumente
{left} gefolgt von {right}
{left} oder {right}
{left} und {right}
nicht {operand}
das Negative von {operand}
{left} ist gleich {right}
{left} ist ungleich {right}
{left} ist kleiner als {right}
{left} ist höchstens {right}
{left} ist größer als {right}
{left} ist mindestens {right}
{left} plus {right}
{left} minus {right}
{left} mal {right}
{left} geteilt durch {right}
{left} modulo {right}
""", "Ackermann Flaschen gemeinsam Anzahl aktuell Ziffern Scheiben Teiler Fakultät Fibonacci erste größte Hagelkorn Index ist Schalt Grenze bewege nächste Zahl von vorherige Primzahl Rest zweite Quelle Hilfe Quadrate Schritt Schritte Summe Ziel Gesamt Jahr"),
({'id': 'japanese', 'label': 'Japanese', 'native-label': '日本語', 'family': 'Japonic', 'speakers': '125 million',
  'end': '。', 'block': '：', 'quotes': '「」', 'separator': '、', 'and': 'と', 'true': '真', 'false': '偽', 'note': '注：{text}'}, """
{name} を {parameters} で 定義 する
{name} を 定義 する
{name} を 値 {value} で 作る
{name} を {value} に 変える
{value} を 書いて 改行 する
{value} を 書く
{value} を 返す
ここで 止める
何も しない
{expression} を 実行 する
もし {condition} なら 次 を する
そうでなく もし {condition} なら 次 を する
そうでなければ 次 を する
{condition} の 間 次 を 繰り返す
{variable} を {start} から {last} まで 数えて 次 を 繰り返す
""" + PAREN_CALL + """
{left} に 続けて {right}
{left} または {right}
{left} かつ {right}
{operand} で ない
マイナス {operand}
{left} が {right} に 等しい
{left} が {right} に 等しく ない
{left} が {right} より 小さい
{left} が {right} 以下
{left} が {right} より 大きい
{left} が {right} 以上
{left} 足す {right}
{left} 引く {right}
{left} 掛ける {right}
{left} 割る {right}
{left} 剰余 {right}
""", "アッカーマン 瓶 共通 個数 現在 桁 円盤 約数 階乗 フィボナッチ 第一 最大 雹 添字 判定 閏 上限 移動 次 数 の 前 素数 余り 第二 元 予備 平方 段 段数 和 先 合計 年"),
({'id': 'marathi', 'label': 'Marathi', 'native-label': 'मराठी', 'family': 'Indo-European', 'speakers': '99 million',
  'quotes': '“”', 'and': 'आणि', 'true': 'सत्य', 'false': 'असत्य', 'note': 'टीप: {text}'}, """
{name} ची व्याख्या {parameters} वापरून करा
{name} ची व्याख्या करा
{name} हे मूल्य {value} सह तयार करा
{name} ला {value} मध्ये बदला
{value} लिहा आणि ओळ संपवा
{value} लिहा
{value} परत द्या
इथे थांबा
काहीही करू नका
{expression} चालवा
जर {condition} तर हे करा
नाहीतर जर {condition} तर हे करा
नाहीतर हे करा
जोपर्यंत {condition} तोपर्यंत हे पुन्हा करा
प्रत्येक {variable} साठी {start} पासून {last} पर्यंत हे पुन्हा करा
""" + PAREN_CALL + """
{left} नंतर {right}
{left} किंवा {right}
{left} आणि {right}
नाही {operand}
ऋण {operand}
{left} चे मूल्य {right} इतके आहे
{left} चे मूल्य {right} इतके नाही
{left} चे मूल्य {right} पेक्षा कमी आहे
{left} चे मूल्य {right} पेक्षा जास्त नाही
{left} चे मूल्य {right} पेक्षा जास्त आहे
{left} चे मूल्य {right} पेक्षा कमी नाही
{left} अधिक {right}
{left} वजा {right}
{left} गुणिले {right}
{left} भागिले {right}
{left} मॉड्यूलो {right}
""", "एकरमन बाटल्या सामाईक मोजणी सध्याचा अंक तबकड्या विभाजक क्रमगुणित फिबोनाची पहिला महत्तम गारा निर्देशांक का लीप मर्यादा हलवा पुढील संख्या चा मागील मूळ बाकी दुसरा उगम राखीव वर्ग पायरी पायऱ्या बेरीज लक्ष्य एकूण वर्ष"),
({'id': 'telugu', 'label': 'Telugu', 'native-label': 'తెలుగు', 'family': 'Dravidian', 'speakers': '95 million',
  'quotes': '“”', 'and': 'మరియు', 'true': 'నిజం', 'false': 'అబద్ధం', 'note': 'గమనిక: {text}'}, """
{name} ను {parameters} తో నిర్వచించు
{name} ను నిర్వచించు
{name} ను విలువ {value} తో సృష్టించు
{name} ను {value} గా మార్చు
{value} రాసి పంక్తి ముగించు
{value} రాయి
{value} తిరిగి ఇవ్వు
ఇక్కడ ఆగు
ఏమీ చేయవద్దు
{expression} అమలు చేయి
ఒకవేళ {condition} అయితే ఇది చేయి
లేకపోతే ఒకవేళ {condition} అయితే ఇది చేయి
లేకపోతే ఇది చేయి
{condition} ఉన్నంత వరకు ఇది పునరావృతం చేయి
ప్రతి {variable} కి {start} నుండి {last} వరకు ఇది పునరావృతం చేయి
""" + PAREN_CALL + """
{left} తర్వాత {right}
{left} లేదా {right}
{left} మరియు {right}
కాదు {operand}
రుణ {operand}
{left} విలువ {right} కి సమానం
{left} విలువ {right} కి సమానం కాదు
{left} విలువ {right} కంటే తక్కువ
{left} విలువ {right} కంటే ఎక్కువ కాదు
{left} విలువ {right} కంటే ఎక్కువ
{left} విలువ {right} కంటే తక్కువ కాదు
{left} కూడిక {right}
{left} తీసివేత {right}
{left} గుణకారం {right}
{left} భాగహారం {right}
{left} మాడ్యులో {right}
""", "అకెర్మాన్ సీసాలు ఉమ్మడి లెక్క ప్రస్తుత అంకెలు పళ్ళాలు భాజకం క్రమగుణితం ఫిబొనాక్సీ మొదటి గరిష్ఠ వడగళ్ళు సూచిక అవునా లీపు పరిమితి కదుపు తదుపరి సంఖ్య యొక్క మునుపటి ప్రధాన శేషం రెండవ మూలం అదనపు వర్గాలు అడుగు అడుగులు మొత్తం లక్ష్యం సమస్తం సంవత్సరం"),
({'id': 'turkish', 'label': 'Turkish', 'native-label': 'Türkçe', 'family': 'Turkic', 'speakers': '90 million',
  'quotes': '“”', 'and': 've', 'true': 'doğru', 'false': 'yanlış', 'note': 'Not: {text}'}, """
{name} işlevini {parameters} ile tanımla
{name} işlevini tanımla
{name} değişkenini {value} değeriyle oluştur
{name} değerini {value} yap
{value} yaz ve satırı bitir
{value} yaz
{value} döndür
Burada dur
Hiçbir şey yapma
{expression} çalıştır
Eğer {condition} ise şunu yap
Değilse eğer {condition} ise şunu yap
Değilse şunu yap
{condition} olduğu sürece şunu tekrarla
Her {variable} için {start} ile {last} arasında şunu tekrarla
""" + PAREN_CALL + """
{left} ardından {right}
{left} veya {right}
{left} ve {right}
{operand} değil
negatif {operand}
{left} ile {right} eşit
{left} ile {right} farklı
{left} {right} değerinden küçük
{left} en fazla {right}
{left} {right} değerinden büyük
{left} en az {right}
{left} artı {right}
{left} eksi {right}
{left} çarpı {right}
{left} bölü {right}
{left} mod {right}
""", "ackermann şişeler ortak sayaç mevcut basamaklar diskler bölen faktöriyel fibonacci birinci azami dolu indeks mi artık sınır taşı sonraki sayı nin önceki asal kalan ikinci kaynak yedek kareler adım adımlar toplam hedef tutar yıl"),
({'id': 'tamil', 'label': 'Tamil', 'native-label': 'தமிழ்', 'family': 'Dravidian', 'speakers': '85 million',
  'quotes': '“”', 'and': 'மற்றும்', 'true': 'உண்மை', 'false': 'பொய்', 'note': 'குறிப்பு: {text}'}, """
{name} ஐ {parameters} கொண்டு வரையறு
{name} ஐ வரையறு
{name} ஐ மதிப்பு {value} உடன் உருவாக்கு
{name} ஐ {value} ஆக மாற்று
{value} எழுதி வரியை முடி
{value} எழுது
{value} திருப்பி அனுப்பு
இங்கே நிறுத்து
எதுவும் செய்யாதே
{expression} இயக்கு
ஒருவேளை {condition} என்றால் இதைச் செய்
இல்லையெனில் ஒருவேளை {condition} என்றால் இதைச் செய்
இல்லையெனில் இதைச் செய்
{condition} இருக்கும் வரை இதை மீண்டும் செய்
ஒவ்வொரு {variable} க்கும் {start} முதல் {last} வரை இதை மீண்டும் செய்
""" + PAREN_CALL + """
{left} அதன் பின் {right}
{left} அல்லது {right}
{left} மற்றும் {right}
அல்ல {operand}
எதிர்மறை {operand}
{left} மதிப்பு {right} க்கு சமம்
{left} மதிப்பு {right} க்கு சமம் அல்ல
{left} மதிப்பு {right} ஐ விட குறைவு
{left} மதிப்பு {right} ஐ விட அதிகம் அல்ல
{left} மதிப்பு {right} ஐ விட அதிகம்
{left} மதிப்பு {right} ஐ விட குறைவு அல்ல
{left} கூட்டல் {right}
{left} கழித்தல் {right}
{left} பெருக்கல் {right}
{left} வகுத்தல் {right}
{left} மாடுலோ {right}
""", "அக்கர்மன் புட்டிகள் பொது எண்ணிக்கை தற்போதைய இலக்கங்கள் வட்டுகள் வகுஎண் காரணீயம் பிபனாச்சி முதலாவது மீப்பெரு ஆலங்கட்டி சுட்டெண் ஆகுமா நெட்டு வரம்பு நகர்த்து அடுத்த எண் இன் முந்தைய பகாஎண் மீதி இரண்டாவது மூலம் உதிரி வர்க்கங்கள் படி படிகள் கூடுதல் இலக்கு மொத்தம் ஆண்டு"),
({'id': 'vietnamese', 'label': 'Vietnamese', 'native-label': 'Tiếng Việt', 'family': 'Austroasiatic', 'speakers': '85 million',
  'quotes': '“”', 'and': 'và', 'true': 'đúng', 'false': 'sai', 'note': 'Ghi chú: {text}'}, """
Định nghĩa {name} với {parameters}
Định nghĩa {name}
Tạo {name} với giá trị {value}
Đổi {name} thành {value}
Viết {value} và xuống dòng
Viết {value}
Trả về {value}
Dừng ở đây
Không làm gì
Thực hiện {expression}
Nếu {condition}, làm điều này
Ngược lại, nếu {condition}, làm điều này
Ngược lại, làm điều này
Trong khi {condition}, lặp lại điều này
Với mỗi {variable} từ {start} đến {last}, lặp lại điều này
{callee} của ({arguments})
{callee} không đối số
{left} nối với {right}
{left} hoặc {right}
{left} và {right}
không {operand}
âm {operand}
{left} bằng {right}
{left} khác {right}
{left} nhỏ hơn {right}
{left} không lớn hơn {right}
{left} lớn hơn {right}
{left} không nhỏ hơn {right}
{left} cộng {right}
{left} trừ {right}
{left} nhân {right}
{left} chia {right}
{left} chia lấy dư {right}
""", "ackermann chai chung số_lượng hiện_tại chữ_số đĩa ước giai_thừa fibonacci thứ_nhất lớn_nhất mưa_đá chỉ_số là nhuận giới_hạn di_chuyển tiếp_theo số của trước_đó nguyên_tố số_dư thứ_hai nguồn phụ bình_phương bước các_bước tổng đích tổng_cộng năm"),
({'id': 'korean', 'label': 'Korean', 'native-label': '한국어', 'family': 'Koreanic', 'speakers': '80 million',
  'quotes': '“”', 'and': '및', 'true': '참', 'false': '거짓', 'note': '참고: {text}'}, """
{name} 을 {parameters} 로 정의한다
{name} 을 정의한다
{name} 을 값 {value} 로 만든다
{name} 을 {value} 로 바꾼다
{value} 을 쓰고 줄을 바꾼다
{value} 을 쓴다
{value} 을 돌려준다
여기서 멈춘다
아무것도 하지 않는다
{expression} 을 실행한다
만약 {condition} 이면 다음을 한다
아니고 만약 {condition} 이면 다음을 한다
아니면 다음을 한다
{condition} 인 동안 다음을 반복한다
각 {variable} 에 대해 {start} 부터 {last} 까지 다음을 반복한다
""" + PAREN_CALL + """
{left} 뒤에 {right}
{left} 또는 {right}
{left} 그리고 {right}
{operand} 아님
음수 {operand}
{left} 이 {right} 과 같음
{left} 이 {right} 과 다름
{left} 이 {right} 보다 작음
{left} 이 {right} 이하
{left} 이 {right} 보다 큼
{left} 이 {right} 이상
{left} 더하기 {right}
{left} 빼기 {right}
{left} 곱하기 {right}
{left} 나누기 {right}
{left} 모듈로 {right}
""", "아커만 병 공통 개수 현재 자릿수 원판 약수 계승 피보나치 첫째 최대 우박 색인 여부 윤 한계 옮기기 다음 수 의 이전 소수 나머지 둘째 출발 보조 제곱 단계 단계들 합 목표 총계 연도"),
({'id': 'italian', 'label': 'Italian', 'native-label': 'Italiano', 'family': 'Indo-European', 'speakers': '65 million',
  'quotes': '«»', 'and': 'e', 'true': 'vero', 'false': 'falso', 'note': 'Nota: {text}'}, """
Definisci {name} usando {parameters}
Definisci {name}
Crea {name} con valore {value}
Cambia {name} in {value}
Scrivi {value} e termina la riga
Scrivi {value}
Restituisci {value}
Fermati qui
Non fare niente
Esegui {expression}
Se {condition}, fai questo
Altrimenti, se {condition}, fai questo
Altrimenti, fai questo
Finché {condition}, ripeti questo
Per ogni {variable} da {start} a {last}, ripeti questo
{callee} di ({arguments})
{callee} senza argomenti
{left} seguito da {right}
{left} o {right}
{left} e {right}
non {operand}
l'opposto di {operand}
{left} è uguale a {right}
{left} è diverso da {right}
{left} è minore di {right}
{left} è al massimo {right}
{left} è maggiore di {right}
{left} è almeno {right}
{left} più {right}
{left} meno {right}
{left} per {right}
{left} diviso {right}
{left} modulo {right}
""", "ackermann bottiglie comune conteggio corrente cifre dischi divisore fattoriale fibonacci iniziale massimo grandine indice è bisestile limite sposta successivo numero di precedente primo resto secondo sorgente ausiliario quadrati passo passi somma destinazione totale anno"),
({'id': 'persian', 'label': 'Persian', 'native-label': 'فارسی', 'family': 'Indo-European', 'speakers': '80 million',
  'quotes': '«»', 'separator': '،', 'and': 'و', 'true': 'درست', 'false': 'نادرست', 'note': 'یادداشت: {text}'}, """
{name} را با {parameters} تعریف کن
{name} را تعریف کن
{name} را با مقدار {value} بساز
{name} را به {value} تغییر بده
{value} را بنویس و سطر را تمام کن
{value} را بنویس
{value} را برگردان
اینجا بایست
هیچ کاری نکن
{expression} را اجرا کن
اگر {condition} آنگاه این را انجام بده
وگرنه اگر {condition} آنگاه این را انجام بده
وگرنه این را انجام بده
تا وقتی {condition} این را تکرار کن
برای هر {variable} از {start} تا {last} این را تکرار کن
""" + PAREN_CALL + """
{left} سپس {right}
{left} یا {right}
{left} و {right}
نه {operand}
منفی {operand}
{left} برابر {right} است
{left} برابر {right} نیست
{left} کمتر از {right} است
{left} بیشتر از {right} نیست
{left} بیشتر از {right} است
{left} کمتر از {right} نیست
{left} بعلاوه {right}
{left} منهای {right}
{left} ضربدر {right}
{left} تقسیم بر {right}
{left} به پیمانه {right}
""", "آکرمن بطری‌ها مشترک شمار کنونی رقم‌ها دیسک‌ها بخشیاب فاکتوریل فیبوناچی نخستین بزرگترین تگرگ نمایه آیا کبیسه حد جابجا بعدی عدد از قبلی اول باقیمانده دومین مبدأ کمکی مربع‌ها گام گام‌ها مجموع مقصد کل سال"),
({'id': 'swahili', 'label': 'Swahili', 'native-label': 'Kiswahili', 'family': 'Niger-Congo', 'speakers': '80 million',
  'quotes': '“”', 'and': 'na', 'true': 'kweli', 'false': 'uongo', 'note': 'Kumbuka: {text}'}, """
Fafanua {name} kwa {parameters}
Fafanua {name}
Unda {name} yenye thamani {value}
Badilisha {name} kuwa {value}
Andika {value} na umalize mstari
Andika {value}
Rudisha {value}
Simama hapa
Usifanye chochote
Endesha {expression}
Ikiwa {condition}, fanya hivi
Vinginevyo, ikiwa {condition}, fanya hivi
Vinginevyo, fanya hivi
Wakati {condition}, rudia hivi
Kwa kila {variable} kutoka {start} hadi {last}, rudia hivi
{callee} ya ({arguments})
{callee} bila hoja
{left} ikifuatiwa na {right}
{left} au {right}
{left} na {right}
si {operand}
hasi ya {operand}
{left} ni sawa na {right}
{left} si sawa na {right}
{left} ni chini ya {right}
{left} si zaidi ya {right}
{left} ni zaidi ya {right}
{left} si chini ya {right}
{left} jumlisha {right}
{left} toa {right}
{left} mara {right}
{left} gawanya kwa {right}
{left} modulo {right}
""", "ackermann chupa pamoja hesabu sasa tarakimu diski kigawanyo faktoria fibonacci kwanza kubwa mvuamawe fahirisi je mrefu kikomo hamisha ijayo nambari ya iliyopita tasa baki pili chanzo akiba miraba hatua vipindi jumla lengo kiasi mwaka"),
({'id': 'tagalog', 'label': 'Tagalog', 'native-label': 'Tagalog', 'family': 'Austronesian', 'speakers': '80 million',
  'quotes': '“”', 'and': 'at', 'true': 'totoo', 'false': 'mali', 'note': 'Tala: {text}'}, """
Tukuyin ang {name} gamit ang {parameters}
Tukuyin ang {name}
Lumikha ng {name} na may halagang {value}
Palitan ang {name} ng {value}
Isulat ang {value} at tapusin ang linya
Isulat ang {value}
Ibalik ang {value}
Huminto dito
Walang gawin
Patakbuhin ang {expression}
Kung {condition}, gawin ito
Kung hindi, kung {condition}, gawin ito
Kung hindi, gawin ito
Habang {condition}, ulitin ito
Para sa bawat {variable} mula {start} hanggang {last}, ulitin ito
{callee} ng ({arguments})
{callee} na walang argumento
{left} na sinusundan ng {right}
{left} o {right}
{left} at {right}
hindi {operand}
negatibo ng {operand}
{left} ay katumbas ng {right}
{left} ay hindi katumbas ng {right}
{left} ay mas mababa sa {right}
{left} ay hindi hihigit sa {right}
{left} ay mas mataas sa {right}
{left} ay hindi bababa sa {right}
{left} dagdag {right}
{left} bawas {right}
{left} beses {right}
{left} hinati sa {right}
{left} modulo {right}
""", "ackermann bote karaniwan bilang kasalukuyan digito disko panghati paktoryal fibonacci una pinakamalaki graniso indeks ba bisyesto hangganan ilipat susunod numero ng nakaraan primo natira ikalawa pinagmulan reserba parisukat hakbang yugto kabuuan patutunguhan lahat taon"),
({'id': 'thai', 'label': 'Thai', 'native-label': 'ภาษาไทย', 'family': 'Kra-Dai', 'speakers': '60 million',
  'quotes': '“”', 'and': 'และ', 'true': 'จริง', 'false': 'เท็จ', 'note': 'หมายเหตุ: {text}'}, """
นิยาม {name} ด้วย {parameters}
นิยาม {name}
สร้าง {name} ด้วย ค่า {value}
เปลี่ยน {name} เป็น {value}
เขียน {value} แล้ว ขึ้น บรรทัด ใหม่
เขียน {value}
คืน ค่า {value}
หยุด ที่นี่
ไม่ ทำ อะไร
ทำงาน {expression}
ถ้า {condition} ให้ ทำ สิ่งนี้
มิฉะนั้น ถ้า {condition} ให้ ทำ สิ่งนี้
มิฉะนั้น ให้ ทำ สิ่งนี้
ขณะที่ {condition} ให้ ทำ ซ้ำ สิ่งนี้
สำหรับ แต่ละ {variable} จาก {start} ถึง {last} ให้ ทำ ซ้ำ สิ่งนี้
""" + PAREN_CALL + """
{left} ต่อ ด้วย {right}
{left} หรือ {right}
{left} และ {right}
ไม่ {operand}
ค่าลบ ของ {operand}
{left} เท่ากับ {right}
{left} ไม่ เท่ากับ {right}
{left} น้อยกว่า {right}
{left} ไม่ มากกว่า {right}
{left} มากกว่า {right}
{left} ไม่ น้อยกว่า {right}
{left} บวก {right}
{left} ลบ {right}
{left} คูณ {right}
{left} หาร {right}
{left} มอดุโล {right}
""", "อัคเคอร์มันน์ ขวด ร่วม จำนวน ปัจจุบัน หลัก จาน ตัวหาร แฟกทอเรียล ฟีโบนัชชี แรก มากสุด ลูกเห็บ ดัชนี เป็น อธิก ขีดจำกัด ย้าย ถัดไป เลข ของ ก่อนหน้า เฉพาะ เศษ ที่สอง ต้นทาง สำรอง กำลังสอง ขั้น ขั้นตอน ผลรวม ปลายทาง รวม ปี"),
({'id': 'polish', 'label': 'Polish', 'native-label': 'Polski', 'family': 'Indo-European', 'speakers': '45 million',
  'quotes': '„”', 'and': 'i', 'true': 'prawda', 'false': 'fałsz', 'note': 'Uwaga: {text}'}, """
Zdefiniuj {name} używając {parameters}
Zdefiniuj {name}
Utwórz {name} z wartością {value}
Zmień {name} na {value}
Wypisz {value} i zakończ wiersz
Wypisz {value}
Zwróć {value}
Zatrzymaj się tutaj
Nic nie rób
Wykonaj {expression}
Jeśli {condition}, zrób to
W przeciwnym razie, jeśli {condition}, zrób to
W przeciwnym razie zrób to
Dopóki {condition}, powtarzaj to
Dla każdego {variable} od {start} do {last} powtarzaj to
{callee} dla ({arguments})
{callee} bez argumentów
{left} a następnie {right}
{left} lub {right}
{left} i {right}
nie {operand}
przeciwieństwo {operand}
{left} równa się {right}
{left} nie równa się {right}
{left} jest mniejsze od {right}
{left} nie przekracza {right}
{left} przekracza {right}
{left} jest co najmniej {right}
{left} plus {right}
{left} minus {right}
{left} razy {right}
{left} podzielone przez {right}
{left} modulo {right}
""", "ackermann butelki wspólny licznik bieżący cyfry krążki dzielnik silnia fibonacci pierwszy największy grad indeks czy przestępny limit przenieś następny liczba z poprzedni pierwsza reszta drugi źródło pomocniczy kwadraty krok kroki suma cel razem rok"),
({'id': 'ukrainian', 'label': 'Ukrainian', 'native-label': 'Українська', 'family': 'Indo-European', 'speakers': '40 million',
  'quotes': '«»', 'and': 'і', 'true': 'істина', 'false': 'хиба', 'note': 'Примітка: {text}'}, """
Визначити {name} через {parameters}
Визначити {name}
Створити {name} зі значенням {value}
Змінити {name} на {value}
Написати {value} і завершити рядок
Написати {value}
Повернути {value}
Зупинитися тут
Нічого не робити
Виконати {expression}
Якщо {condition}, зробити це
Інакше, якщо {condition}, зробити це
Інакше зробити це
Поки {condition}, повторювати це
Для кожного {variable} від {start} до {last} повторювати це
{callee} від ({arguments})
{callee} без аргументів
{left} потім {right}
{left} або {right}
{left} і {right}
не {operand}
протилежне {operand}
{left} дорівнює {right}
{left} не дорівнює {right}
{left} менше за {right}
{left} не більше за {right}
{left} більше за {right}
{left} не менше за {right}
{left} плюс {right}
{left} мінус {right}
{left} помножити на {right}
{left} поділити на {right}
{left} за модулем {right}
""", "аккерман пляшки спільний кількість поточний цифри диски дільник факторіал фібоначчі перший найбільший градина індекс є високосний межа перемістити наступний число з попередній просте остача другий джерело запасний квадрати крок кроки сума ціль підсумок рік"),
({'id': 'hausa', 'label': 'Hausa', 'native-label': 'Hausa', 'family': 'Afro-Asiatic', 'speakers': '80 million',
  'quotes': '“”', 'and': 'da', 'true': 'gaskiya', 'false': 'ƙarya', 'note': 'Lura: {text}'}, """
Ayyana {name} da {parameters}
Ayyana {name}
Ƙirƙiri {name} mai ƙima {value}
Canza {name} zuwa {value}
Rubuta {value} kuma ka gama layi
Rubuta {value}
Mayar da {value}
Tsaya nan
Kada ka yi komai
Gudanar da {expression}
Idan {condition}, yi wannan
In ba haka ba, idan {condition}, yi wannan
In ba haka ba, yi wannan
Yayin da {condition}, maimaita wannan
Ga kowane {variable} daga {start} zuwa {last}, maimaita wannan
{callee} na ({arguments})
{callee} ba tare da hujja ba
{left} sannan {right}
{left} ko {right}
{left} kuma {right}
akasin {operand}
korau na {operand}
{left} daidai yake da {right}
{left} bai yi daidai da {right}
{left} ya gaza {right}
{left} bai wuce {right}
{left} ya wuce {right}
{left} bai gaza {right}
{left} ƙari {right}
{left} ragi {right}
{left} sau {right}
{left} raba da {right}
{left} modulo {right}
""", "ackermann kwalabe tarayya ƙidaya yanzu lambobi faifai rabo fakitoriyal fibonacci farko babba ƙanƙara fihirisa shin tsalle iyaka matsar gaba lamba na baya tushe saura biyu asali ajiya murabba'ai mataki matakai jimla manufa duka shekara"),
({'id': 'gujarati', 'label': 'Gujarati', 'native-label': 'ગુજરાતી', 'family': 'Indo-European', 'speakers': '60 million',
  'quotes': '“”', 'and': 'અને', 'true': 'સાચું', 'false': 'ખોટું', 'note': 'નોંધ: {text}'}, """
{name} ને {parameters} વડે વ્યાખ્યાયિત કરો
{name} ને વ્યાખ્યાયિત કરો
{name} ને કિંમત {value} સાથે બનાવો
{name} ને {value} માં બદલો
{value} લખો અને લીટી પૂરી કરો
{value} લખો
{value} પાછું આપો
અહીં અટકો
કંઈ ન કરો
{expression} ચલાવો
જો {condition} તો આ કરો
નહીંતર જો {condition} તો આ કરો
નહીંતર આ કરો
જ્યાં સુધી {condition} ત્યાં સુધી આ ફરી કરો
દરેક {variable} માટે {start} થી {last} સુધી આ ફરી કરો
""" + PAREN_CALL + """
{left} પછી {right}
{left} અથવા {right}
{left} અને {right}
નહીં {operand}
ઋણ {operand}
{left} નું મૂલ્ય {right} બરાબર છે
{left} નું મૂલ્ય {right} બરાબર નથી
{left} નું મૂલ્ય {right} કરતાં ઓછું છે
{left} નું મૂલ્ય {right} કરતાં વધુ નથી
{left} નું મૂલ્ય {right} કરતાં વધુ છે
{left} નું મૂલ્ય {right} કરતાં ઓછું નથી
{left} વત્તા {right}
{left} ઓછા {right}
{left} ગુણ્યા {right}
{left} ભાગ્યા {right}
{left} મોડ્યુલો {right}
""", "એકરમેન બોટલો સામાન્ય ગણતરી વર્તમાન અંકો તકતીઓ ભાજક ક્રમગુણિત ફિબોનાકી પ્રથમ મહત્તમ કરા અનુક્રમ શું લીપ મર્યાદા ખસેડો આગળનું સંખ્યા નો પાછલું અવિભાજ્ય શેષ બીજું સ્રોત વધારાનું વર્ગો પગલું પગલાં સરવાળો લક્ષ્ય કુલ વર્ષ"),
({'id': 'punjabi', 'label': 'Punjabi', 'native-label': 'ਪੰਜਾਬੀ', 'family': 'Indo-European', 'speakers': '110 million',
  'end': '।', 'quotes': '“”', 'and': 'ਅਤੇ', 'true': 'ਸੱਚ', 'false': 'ਝੂਠ', 'note': 'ਨੋਟ: {text}'}, """
{name} ਨੂੰ {parameters} ਨਾਲ ਪਰਿਭਾਸ਼ਿਤ ਕਰੋ
{name} ਨੂੰ ਪਰਿਭਾਸ਼ਿਤ ਕਰੋ
{name} ਨੂੰ ਮੁੱਲ {value} ਨਾਲ ਬਣਾਓ
{name} ਨੂੰ {value} ਵਿੱਚ ਬਦਲੋ
{value} ਲਿਖੋ ਅਤੇ ਸਤਰ ਖਤਮ ਕਰੋ
{value} ਲਿਖੋ
{value} ਵਾਪਸ ਕਰੋ
ਇੱਥੇ ਰੁਕੋ
ਕੁਝ ਨਾ ਕਰੋ
{expression} ਚਲਾਓ
ਜੇ {condition} ਤਾਂ ਇਹ ਕਰੋ
ਵਰਨਾ ਜੇ {condition} ਤਾਂ ਇਹ ਕਰੋ
ਵਰਨਾ ਇਹ ਕਰੋ
ਜਦੋਂ ਤੱਕ {condition} ਤਦ ਤੱਕ ਇਹ ਦੁਹਰਾਓ
ਹਰ {variable} ਲਈ {start} ਤੋਂ {last} ਤੱਕ ਇਹ ਦੁਹਰਾਓ
""" + PAREN_CALL + """
{left} ਤੋਂ ਬਾਅਦ {right}
{left} ਜਾਂ {right}
{left} ਅਤੇ {right}
ਨਹੀਂ {operand}
ਰਿਣ {operand}
{left} ਦਾ ਮੁੱਲ {right} ਦੇ ਬਰਾਬਰ ਹੈ
{left} ਦਾ ਮੁੱਲ {right} ਦੇ ਬਰਾਬਰ ਨਹੀਂ ਹੈ
{left} ਦਾ ਮੁੱਲ {right} ਤੋਂ ਘੱਟ ਹੈ
{left} ਦਾ ਮੁੱਲ {right} ਤੋਂ ਵੱਧ ਨਹੀਂ ਹੈ
{left} ਦਾ ਮੁੱਲ {right} ਤੋਂ ਵੱਧ ਹੈ
{left} ਦਾ ਮੁੱਲ {right} ਤੋਂ ਘੱਟ ਨਹੀਂ ਹੈ
{left} ਜਮ੍ਹਾਂ {right}
{left} ਘਟਾਓ {right}
{left} ਗੁਣਾ {right}
{left} ਭਾਗ {right}
{left} ਮੋਡਿਊਲੋ {right}
""", "ਐਕਰਮੈਨ ਬੋਤਲਾਂ ਸਾਂਝਾ ਗਿਣਤੀ ਮੌਜੂਦਾ ਅੰਕ ਡਿਸਕਾਂ ਭਾਜਕ ਫੈਕਟੋਰੀਅਲ ਫਿਬੋਨਾਚੀ ਪਹਿਲਾ ਮਹੱਤਮ ਗੜਾ ਸੂਚਕ ਕੀ ਲੀਪ ਸੀਮਾ ਹਿਲਾਓ ਅਗਲਾ ਸੰਖਿਆ ਦਾ ਪਿਛਲਾ ਅਭਾਜ ਬਾਕੀ ਦੂਜਾ ਸਰੋਤ ਵਾਧੂ ਵਰਗ ਕਦਮ ਕਦਮਾਂ ਜੋੜ ਨਿਸ਼ਾਨਾ ਕੁੱਲ ਸਾਲ"),
({'id': 'dutch', 'label': 'Dutch', 'native-label': 'Nederlands', 'family': 'Indo-European', 'speakers': '25 million',
  'quotes': '“”', 'and': 'en', 'true': 'waar', 'false': 'onwaar', 'note': 'Opmerking: {text}'}, """
Definieer {name} met {parameters}
Definieer {name}
Maak {name} met waarde {value}
Verander {name} in {value}
Schrijf {value} en beëindig de regel
Schrijf {value}
Geef {value} terug
Stop hier
Doe niets
Voer {expression} uit
Als {condition}, doe dit
Anders, als {condition}, doe dit
Anders, doe dit
Zolang {condition}, herhaal dit
Voor elke {variable} van {start} tot en met {last}, herhaal dit
{callee} van ({arguments})
{callee} zonder argumenten
{left} gevolgd door {right}
{left} of {right}
{left} en {right}
niet {operand}
het tegengestelde van {operand}
{left} is gelijk aan {right}
{left} is ongelijk aan {right}
{left} is kleiner dan {right}
{left} is hoogstens {right}
{left} is groter dan {right}
{left} is minstens {right}
{left} plus {right}
{left} min {right}
{left} maal {right}
{left} gedeeld door {right}
{left} modulo {right}
""", "ackermann flessen gemeenschappelijk aantal huidig cijfers schijven deler faculteit fibonacci eerste grootste hagelsteen index is schrikkel limiet verplaats volgende getal van vorige priem rest tweede bron reserve kwadraten stap stappen som doel totaal jaar"),
]

if __name__ == '__main__':
    for spec in LANGUAGES:
        if len(sys.argv) < 2 or spec[0]['id'] in sys.argv[1:]:
            write(spec)
    print(len(LANGUAGES), 'languages')
