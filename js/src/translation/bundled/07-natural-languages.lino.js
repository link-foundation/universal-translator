// Generated from data/07-natural-languages.lino.
export default `profile:
  id: en
  label: English
  kind: natural-language
  comment: '#'
  call: instruction
  output: Write
  forms:
    form:
      task: hello
      name: standard
      source:
        (line: 'Write the text “{{message}}” to standard output, then write a newline.')
    form:
      task: write-text
      name: standard
      source:
        (line: 'Write the text “{{message}}” to standard output without adding a newline.')
    form:
      task: gcd-function
      name: standard
      source:
        (line: 'Accept two integers between −{{max}} and {{max}}, inclusive, and take their absolute values.')
        (line: 'While the second value is positive, replace the pair with the second value and the remainder of the first divided by the second. Return the first value.')
    form:
      task: greatest-common-divisor
      name: standard
      source:
        (line: 'Set left to {{left}} and right to {{right}}.')
        (line: 'While right is nonzero, replace left and right together with right and the remainder of left divided by right.')
        (line: 'Write left in decimal to standard output, followed by a newline.')
    form:
      task: fizz-buzz
      name: standard
      source:
        (line: 'Visit each integer from 1 through {{limit}}, in ascending order.')
        (line: 'For each integer, write FizzBuzz if it is divisible by both 3 and 5, Fizz if it is divisible only by 3, Buzz if it is divisible only by 5, or the integer in decimal otherwise.')
        (line: 'Write each result on its own line of standard output.')

profile:
  id: zh
  label: 'Mandarin Chinese'
  kind: natural-language
  comment: '#'
  call: instruction
  output: 输出
  forms:
    form:
      task: hello
      name: standard
      source:
        (line: 向标准输出写入文本“{{message}}”，然后换行。)
    form:
      task: write-text
      name: standard
      source:
        (line: '向标准输出写入文本“{{message}}”，不追加换行符。')
    form:
      task: gcd-function
      name: standard
      source:
        (line: '接收两个从 −{{max}} 到 {{max}} 的整数，包括两端，并取各自的绝对值。')
        (line: '当第二个值为正数时，用第二个值和第一个值除以第二个值所得的余数同时替换这两个值。返回第一个值。')
    form:
      task: greatest-common-divisor
      name: standard
      source:
        (line: '将左值设为 {{left}}，右值设为 {{right}}。')
        (line: 只要右值不为零，就同时将左值和右值分别替换为原来的右值及原来左值除以原来右值所得的余数。)
        (line: 向标准输出写入十进制的左值，然后换行。)
    form:
      task: fizz-buzz
      name: standard
      source:
        (line: '按升序遍历从 1 到 {{limit}} 的每个整数，包括两端。')
        (line: '对每个整数，若能同时被 3 和 5 整除则输出 FizzBuzz；若只能被 3 整除则输出 Fizz；若只能被 5 整除则输出 Buzz；否则输出该整数的十进制表示。')
        (line: 将每个结果各占一行写入标准输出。)

profile:
  id: hi
  label: Hindi
  kind: natural-language
  comment: '#'
  call: instruction
  output: लिखें
  forms:
    form:
      task: hello
      name: standard
      source:
        (line: 'मानक आउटपुट पर “{{message}}” लिखें, फिर एक नई पंक्ति लिखें।')
    form:
      task: write-text
      name: standard
      source:
        (line: 'मानक आउटपुट पर “{{message}}” लिखें और उसके बाद नई पंक्ति न जोड़ें।')
    form:
      task: gcd-function
      name: standard
      source:
        (line: '−{{max}} से {{max}} तक के दो पूर्णांक लें, दोनों सीमाएँ शामिल हैं, और उनके निरपेक्ष मान लें।')
        (line: 'जब तक दूसरा मान धनात्मक है, दोनों मानों को क्रमशः दूसरे मान और पहले मान को दूसरे से भाग देने पर बचे शेषफल से बदलें। पहला मान लौटाएँ।')
    form:
      task: greatest-common-divisor
      name: standard
      source:
        (line: 'बायाँ मान {{left}} और दायाँ मान {{right}} रखें।')
        (line: 'जब तक दायाँ मान शून्य न हो, दोनों मानों को एक साथ बदलें: नया बायाँ मान पुराना दायाँ मान है और नया दायाँ मान पुराने बाएँ को पुराने दाएँ से भाग देने पर बचा शेषफल है।')
        (line: 'मानक आउटपुट पर बायाँ मान दशमलव में लिखें, फिर नई पंक्ति लिखें।')
    form:
      task: fizz-buzz
      name: standard
      source:
        (line: '1 से {{limit}} तक, दोनों सिरों समेत, सभी पूर्णांक बढ़ते क्रम में लें।')
        (line: 'यदि संख्या 3 और 5 दोनों से विभाज्य है तो FizzBuzz, केवल 3 से तो Fizz, केवल 5 से तो Buzz, अन्यथा संख्या को दशमलव में लिखें।')
        (line: 'हर परिणाम को मानक आउटपुट पर अलग पंक्ति में लिखें।')

profile:
  id: es
  label: Spanish
  kind: natural-language
  comment: '#'
  call: instruction
  output: Escribe
  forms:
    form:
      task: hello
      name: standard
      source:
        (line: 'Escribe el texto «{{message}}» en la salida estándar y luego escribe un salto de línea.')
    form:
      task: write-text
      name: standard
      source:
        (line: 'Escribe el texto «{{message}}» en la salida estándar sin añadir un salto de línea.')
    form:
      task: gcd-function
      name: standard
      source:
        (line: 'Recibe dos enteros entre −{{max}} y {{max}}, ambos inclusive, y toma sus valores absolutos.')
        (line: 'Mientras el segundo valor sea positivo, sustituye el par por el segundo valor y el resto de dividir el primero entre el segundo. Devuelve el primer valor.')
    form:
      task: greatest-common-divisor
      name: standard
      source:
        (line: 'Asigna {{left}} al valor izquierdo y {{right}} al derecho.')
        (line: 'Mientras el valor derecho no sea cero, sustituye ambos valores a la vez por el valor derecho y el resto de dividir el valor izquierdo entre el derecho, respectivamente.')
        (line: 'Escribe el valor izquierdo en decimal en la salida estándar, seguido de un salto de línea.')
    form:
      task: fizz-buzz
      name: standard
      source:
        (line: 'Recorre en orden ascendente los enteros de 1 a {{limit}}, ambos inclusive.')
        (line: 'Para cada entero, escribe FizzBuzz si es divisible por 3 y 5, Fizz si solo es divisible por 3, Buzz si solo es divisible por 5 o el entero en decimal en los demás casos.')
        (line: 'Escribe cada resultado en una línea de la salida estándar.')

profile:
  id: fr
  label: French
  kind: natural-language
  comment: '#'
  call: instruction
  output: Écris
  forms:
    form:
      task: hello
      name: standard
      source:
        (line: 'Écris le texte « {{message}} » sur la sortie standard, puis un saut de ligne.')
    form:
      task: write-text
      name: standard
      source:
        (line: 'Écris le texte « {{message}} » sur la sortie standard sans ajouter de saut de ligne.')
    form:
      task: gcd-function
      name: standard
      source:
        (line: 'Reçois deux entiers compris entre −{{max}} et {{max}}, bornes incluses, et prends leurs valeurs absolues.')
        (line: 'Tant que la deuxième valeur est positive, remplace la paire par la deuxième valeur et le reste de la division de la première par la deuxième. Renvoie la première valeur.')
    form:
      task: greatest-common-divisor
      name: standard
      source:
        (line: 'Affecte {{left}} à la valeur de gauche et {{right}} à celle de droite.')
        (line: 'Tant que la valeur de droite est différente de zéro, remplace simultanément les deux valeurs par la valeur de droite et le reste de la division de la valeur de gauche par celle de droite, respectivement.')
        (line: 'Écris la valeur de gauche en décimal sur la sortie standard, suivie d’un saut de ligne.')
    form:
      task: fizz-buzz
      name: standard
      source:
        (line: 'Parcours les entiers de 1 à {{limit}} inclus, dans l’ordre croissant.')
        (line: 'Pour chaque entier, écris FizzBuzz s’il est divisible par 3 et par 5, Fizz s’il est divisible par 3 seulement, Buzz s’il est divisible par 5 seulement, ou l’entier en décimal sinon.')
        (line: 'Écris chaque résultat sur une ligne de la sortie standard.')

profile:
  id: ar
  label: 'Standard Arabic'
  kind: natural-language
  comment: '#'
  call: instruction
  output: اكتب
  forms:
    form:
      task: hello
      name: standard
      source:
        (line: 'اكتب النص «{{message}}» على المخرج القياسي، ثم اكتب محرف سطر جديد.')
    form:
      task: write-text
      name: standard
      source:
        (line: 'اكتب النص «{{message}}» على المخرج القياسي من دون إضافة محرف سطر جديد.')
    form:
      task: gcd-function
      name: standard
      source:
        (line: 'اقبل عددين صحيحين من −{{max}} إلى {{max}} شاملًا الحدين، وخذ القيمة المطلقة لكل منهما.')
        (line: 'ما دامت القيمة الثانية موجبة، استبدل الزوج بالقيمة الثانية وباقي قسمة القيمة الأولى عليها. أعد القيمة الأولى.')
    form:
      task: greatest-common-divisor
      name: standard
      source:
        (line: 'اجعل القيمة اليسرى {{left}} واليمنى {{right}}.')
        (line: 'ما دامت القيمة اليمنى غير صفرية، بدّل القيمتين معًا: اليسرى الجديدة هي اليمنى القديمة، واليمنى الجديدة هي باقي قسمة اليسرى القديمة على اليمنى القديمة.')
        (line: 'اكتب القيمة اليسرى بالنظام العشري على المخرج القياسي ثم انتقل إلى سطر جديد.')
    form:
      task: fizz-buzz
      name: standard
      source:
        (line: 'مرّ بالأعداد الصحيحة من 1 إلى {{limit}} شاملًا الطرفين وبترتيب تصاعدي.')
        (line: 'لكل عدد، اكتب FizzBuzz إن قبل القسمة على 3 و5 معًا، وFizz إن قبل القسمة على 3 فقط، وBuzz إن قبل القسمة على 5 فقط، وإلا فاكتب العدد بالنظام العشري.')
        (line: 'اكتب كل نتيجة في سطر مستقل على المخرج القياسي.')

profile:
  id: bn
  label: Bengali
  kind: natural-language
  comment: '#'
  call: instruction
  output: লিখুন
  forms:
    form:
      task: hello
      name: standard
      source:
        (line: 'মানক আউটপুটে “{{message}}” লেখাটি লিখুন, তারপর একটি নতুন লাইন লিখুন।')
    form:
      task: write-text
      name: standard
      source:
        (line: 'মানক আউটপুটে “{{message}}” লেখাটি লিখুন এবং শেষে নতুন লাইন যোগ করবেন না।')
    form:
      task: gcd-function
      name: standard
      source:
        (line: '−{{max}} থেকে {{max}} পর্যন্ত সীমার উভয় প্রান্তসহ দুটি পূর্ণসংখ্যা নিন এবং তাদের পরম মান নিন।')
        (line: 'দ্বিতীয় মান ধনাত্মক থাকলে জোড়াটিকে দ্বিতীয় মান এবং প্রথম মানকে দ্বিতীয় মান দিয়ে ভাগ করার ভাগশেষ দিয়ে বদলান। প্রথম মান ফেরত দিন।')
    form:
      task: greatest-common-divisor
      name: standard
      source:
        (line: 'বামের মান {{left}} এবং ডানের মান {{right}} নির্ধারণ করুন।')
        (line: 'ডানের মান শূন্য না হওয়া পর্যন্ত দুটি মান একসঙ্গে বদলান: নতুন বাম হবে পুরোনো ডান, আর নতুন ডান হবে পুরোনো বামকে পুরোনো ডান দিয়ে ভাগ করার অবশিষ্ট।')
        (line: 'মানক আউটপুটে বামের মান দশমিক সংখ্যায় লিখুন, তারপর নতুন লাইন লিখুন।')
    form:
      task: fizz-buzz
      name: standard
      source:
        (line: '1 থেকে {{limit}} পর্যন্ত উভয় প্রান্তসহ প্রতিটি পূর্ণসংখ্যা ঊর্ধ্বক্রমে নিন।')
        (line: 'সংখ্যাটি 3 ও 5 উভয়টি দিয়ে বিভাজ্য হলে FizzBuzz, শুধু 3 দিয়ে হলে Fizz, শুধু 5 দিয়ে হলে Buzz, অন্যথায় দশমিক সংখ্যাটি লিখুন।')
        (line: 'প্রতিটি ফল মানক আউটপুটে আলাদা লাইনে লিখুন।')

profile:
  id: pt
  label: Portuguese
  kind: natural-language
  comment: '#'
  call: instruction
  output: Escreva
  forms:
    form:
      task: hello
      name: standard
      source:
        (line: 'Escreva o texto «{{message}}» na saída padrão, seguido de uma quebra de linha.')
    form:
      task: write-text
      name: standard
      source:
        (line: 'Escreva o texto «{{message}}» na saída padrão sem acrescentar uma quebra de linha.')
    form:
      task: gcd-function
      name: standard
      source:
        (line: 'Receba dois números inteiros entre −{{max}} e {{max}}, inclusive, e tome seus valores absolutos.')
        (line: 'Enquanto o segundo valor for positivo, substitua o par pelo segundo valor e pelo resto da divisão do primeiro pelo segundo. Retorne o primeiro valor.')
    form:
      task: greatest-common-divisor
      name: standard
      source:
        (line: 'Atribua {{left}} ao valor esquerdo e {{right}} ao direito.')
        (line: 'Enquanto o valor direito for diferente de zero, substitua os dois valores simultaneamente pelo valor direito e pelo resto da divisão do valor esquerdo pelo direito, respectivamente.')
        (line: 'Escreva o valor esquerdo em decimal na saída padrão, seguido de uma quebra de linha.')
    form:
      task: fizz-buzz
      name: standard
      source:
        (line: 'Percorra em ordem crescente todos os inteiros de 1 a {{limit}}, inclusive.')
        (line: 'Para cada inteiro, escreva FizzBuzz se for divisível por 3 e 5, Fizz se for divisível apenas por 3, Buzz se for divisível apenas por 5 ou o inteiro em decimal nos demais casos.')
        (line: 'Escreva cada resultado em sua própria linha na saída padrão.')

profile:
  id: ru
  label: Russian
  kind: natural-language
  comment: '#'
  call: instruction
  output: Выведите
  forms:
    form:
      task: hello
      name: standard
      source:
        (line: 'Выведите текст «{{message}}» в стандартный поток вывода, затем переведите строку.')
    form:
      task: write-text
      name: standard
      source:
        (line: 'Выведите текст «{{message}}» в стандартный поток вывода без перевода строки.')
    form:
      task: gcd-function
      name: standard
      source:
        (line: 'Примите два целых числа от −{{max}} до {{max}} включительно и возьмите их абсолютные значения.')
        (line: 'Пока второе значение положительно, заменяйте пару вторым значением и остатком от деления первого на второе. Верните первое значение.')
    form:
      task: greatest-common-divisor
      name: standard
      source:
        (line: 'Присвойте левому значению {{left}}, а правому — {{right}}.')
        (line: 'Пока правое значение не равно нулю, одновременно заменяйте левое значение прежним правым, а правое — остатком от деления прежнего левого на прежнее правое.')
        (line: 'Выведите левое значение в десятичной записи в стандартный поток вывода и переведите строку.')
    form:
      task: fizz-buzz
      name: standard
      source:
        (line: 'Переберите по возрастанию все целые числа от 1 до {{limit}} включительно.')
        (line: 'Для каждого числа выведите FizzBuzz, если оно делится на 3 и 5, Fizz, если делится только на 3, Buzz, если делится только на 5, иначе выведите число в десятичной записи.')
        (line: 'Выведите каждый результат в отдельной строке стандартного потока вывода.')

profile:
  id: ur
  label: Urdu
  kind: natural-language
  comment: '#'
  call: instruction
  output: لکھیں
  forms:
    form:
      task: hello
      name: standard
      source:
        (line: 'متن «{{message}}» معیاری خروج پر لکھیں، پھر سطر بدلیں۔')
    form:
      task: write-text
      name: standard
      source:
        (line: 'متن «{{message}}» معیاری خروج پر لکھیں اور آخر میں سطر تبدیل نہ کریں۔')
    form:
      task: gcd-function
      name: standard
      source:
        (line: '−{{max}} سے {{max}} تک دو صحیح اعداد لیں، دونوں حدیں شامل ہیں، اور ان کی مطلق قدریں لیں۔')
        (line: 'جب تک دوسری قدر مثبت ہو، جوڑے کو دوسری قدر اور پہلی قدر کو دوسری پر تقسیم کرنے کے باقی سے بدلیں۔ پہلی قدر واپس کریں۔')
    form:
      task: greatest-common-divisor
      name: standard
      source:
        (line: 'بائیں قدر کو {{left}} اور دائیں قدر کو {{right}} مقرر کریں۔')
        (line: 'جب تک دائیں قدر صفر نہ ہو، دونوں قدریں بیک وقت بدلیں: نئی بائیں قدر پرانی دائیں قدر ہے اور نئی دائیں قدر پرانی بائیں کو پرانی دائیں پر تقسیم کرنے کا باقی ہے۔')
        (line: 'بائیں قدر کو اعشاری صورت میں معیاری خروج پر لکھیں اور پھر سطر بدلیں۔')
    form:
      task: fizz-buzz
      name: standard
      source:
        (line: '1 سے {{limit}} تک ہر صحیح عدد کو بڑھتی ترتیب میں لیں، دونوں سروں سمیت۔')
        (line: 'جو عدد 3 اور 5 دونوں سے تقسیم ہو اس کے لیے FizzBuzz، صرف 3 سے ہو تو Fizz، صرف 5 سے ہو تو Buzz، ورنہ اعشاری صورت میں خود عدد لکھیں۔')
        (line: 'ہر نتیجہ معیاری خروج پر ایک الگ سطر میں لکھیں۔')

profile:
  id: id
  label: Indonesian
  kind: natural-language
  comment: '#'
  call: instruction
  output: Tulis
  forms:
    form:
      task: hello
      name: standard
      source:
        (line: 'Tulis teks “{{message}}” ke keluaran standar, lalu tulis karakter baris baru.')
    form:
      task: write-text
      name: standard
      source:
        (line: 'Tulis teks “{{message}}” ke keluaran standar tanpa menambahkan baris baru.')
    form:
      task: gcd-function
      name: standard
      source:
        (line: 'Terima dua bilangan bulat dari −{{max}} sampai {{max}}, termasuk kedua batas, lalu ambil nilai mutlaknya.')
        (line: 'Selama nilai kedua positif, ganti pasangan dengan nilai kedua dan sisa pembagian nilai pertama oleh nilai kedua. Kembalikan nilai pertama.')
    form:
      task: greatest-common-divisor
      name: standard
      source:
        (line: 'Tetapkan nilai kiri ke {{left}} dan nilai kanan ke {{right}}.')
        (line: 'Selama nilai kanan bukan nol, ganti kedua nilai secara bersamaan: nilai kiri baru adalah nilai kanan lama dan nilai kanan baru adalah sisa pembagian nilai kiri lama oleh nilai kanan lama.')
        (line: 'Tulis nilai kiri dalam bentuk desimal ke keluaran standar, lalu tulis karakter baris baru.')
    form:
      task: fizz-buzz
      name: standard
      source:
        (line: 'Telusuri setiap bilangan bulat dari 1 sampai {{limit}}, termasuk keduanya, dalam urutan menaik.')
        (line: 'Untuk tiap bilangan, tulis FizzBuzz jika habis dibagi 3 dan 5, Fizz jika habis dibagi 3 saja, Buzz jika habis dibagi 5 saja, atau bilangan dalam bentuk desimal jika tidak keduanya.')
        (line: 'Tulis setiap hasil pada baris tersendiri di keluaran standar.')

profile:
  id: de
  label: German
  kind: natural-language
  comment: '#'
  call: instruction
  output: Schreibe
  forms:
    form:
      task: hello
      name: standard
      source:
        (line: 'Schreibe den Text „{{message}}“ auf die Standardausgabe, gefolgt von einem Zeilenumbruch.')
    form:
      task: write-text
      name: standard
      source:
        (line: 'Schreibe den Text „{{message}}“ ohne abschließenden Zeilenumbruch in die Standardausgabe.')
    form:
      task: gcd-function
      name: standard
      source:
        (line: 'Nimm zwei ganze Zahlen von −{{max}} bis einschließlich {{max}} an und bilde ihre Beträge.')
        (line: 'Solange der zweite Wert positiv ist, ersetze das Paar durch den zweiten Wert und den Rest der Division des ersten durch den zweiten. Gib den ersten Wert zurück.')
    form:
      task: greatest-common-divisor
      name: standard
      source:
        (line: 'Setze den linken Wert auf {{left}} und den rechten auf {{right}}.')
        (line: 'Solange der rechte Wert ungleich null ist, ersetze beide Werte gleichzeitig: links durch den alten rechten Wert, rechts durch den Rest der Division des alten linken durch den alten rechten Wert.')
        (line: 'Schreibe den linken Wert dezimal auf die Standardausgabe, gefolgt von einem Zeilenumbruch.')
    form:
      task: fizz-buzz
      name: standard
      source:
        (line: 'Durchlaufe die ganzen Zahlen von 1 bis einschließlich {{limit}} in aufsteigender Reihenfolge.')
        (line: 'Schreibe für jede Zahl FizzBuzz, wenn sie durch 3 und 5 teilbar ist, Fizz bei Teilbarkeit nur durch 3, Buzz bei Teilbarkeit nur durch 5, sonst die Zahl in Dezimalschreibweise.')
        (line: 'Schreibe jedes Ergebnis in eine eigene Zeile der Standardausgabe.')

profile:
  id: ja
  label: Japanese
  kind: natural-language
  comment: '#'
  call: instruction
  output: 出力
  forms:
    form:
      task: hello
      name: standard
      source:
        (line: 文字列「{{message}}」を標準出力に書き込み、その後に改行する。)
    form:
      task: write-text
      name: standard
      source:
        (line: 'テキスト「{{message}}」を末尾の改行を加えずに標準出力に書き出す。')
    form:
      task: gcd-function
      name: standard
      source:
        (line: '−{{max}} 以上 {{max}} 以下の整数を二つ受け取り、それぞれの絶対値を取る。')
        (line: '二番目の値が正の間、組を二番目の値と一番目を二番目で割った余りに置き換える。一番目の値を返す。')
    form:
      task: greatest-common-divisor
      name: standard
      source:
        (line: '左の値を {{left}}、右の値を {{right}} に設定する。')
        (line: '右の値が 0 でない間、左の値を更新前の右の値に、右の値を更新前の左の値を更新前の右の値で割った余りに同時に更新する。')
        (line: 左の値を十進数で標準出力に書き込み、その後に改行する。)
    form:
      task: fizz-buzz
      name: standard
      source:
        (line: '1 から {{limit}} までのすべての整数を昇順に処理する。')
        (line: '3 と 5 の両方で割り切れる場合は FizzBuzz、3 だけで割り切れる場合は Fizz、5 だけで割り切れる場合は Buzz、それ以外は整数を十進数で出力する。')
        (line: 各結果を標準出力に一行ずつ書き込む。)

profile:
  id: sw
  label: Swahili
  kind: natural-language
  comment: '#'
  call: instruction
  output: Andika
  forms:
    form:
      task: hello
      name: standard
      source:
        (line: 'Andika maandishi “{{message}}” kwenye pato la kawaida, kisha andika alama ya mstari mpya.')
    form:
      task: write-text
      name: standard
      source:
        (line: 'Andika maandishi “{{message}}” katika towe la kawaida bila kuongeza alama ya mstari mpya.')
    form:
      task: gcd-function
      name: standard
      source:
        (line: 'Pokea namba kamili mbili kuanzia −{{max}} hadi {{max}}, ikijumuisha mipaka yote miwili, kisha chukua thamani zao kamili.')
        (line: 'Kadiri thamani ya pili ilivyo chanya, badilisha jozi iwe thamani ya pili na baki la kugawa thamani ya kwanza kwa ya pili. Rudisha thamani ya kwanza.')
    form:
      task: greatest-common-divisor
      name: standard
      source:
        (line: 'Weka thamani ya kushoto kuwa {{left}} na ya kulia kuwa {{right}}.')
        (line: 'Thamani ya kulia ikiwa si sifuri, badilisha thamani zote mbili kwa pamoja: ya kushoto iwe thamani ya awali ya kulia, na ya kulia iwe baki baada ya kugawa thamani ya awali ya kushoto kwa ya awali ya kulia.')
        (line: 'Andika thamani ya kushoto kwa mfumo wa desimali kwenye pato la kawaida, kisha andika alama ya mstari mpya.')
    form:
      task: fizz-buzz
      name: standard
      source:
        (line: 'Pitia kila namba kamili kuanzia 1 hadi {{limit}}, pamoja na namba za mipaka, kwa mpangilio wa kupanda.')
        (line: 'Andika FizzBuzz ikiwa namba inagawanyika kwa 3 na 5, Fizz ikiwa inagawanyika kwa 3 pekee, Buzz ikiwa inagawanyika kwa 5 pekee, au namba kwa mfumo wa desimali vinginevyo.')
        (line: 'Andika kila jibu kwenye mstari wake katika pato la kawaida.')

profile:
  id: mr
  label: Marathi
  kind: natural-language
  comment: '#'
  call: instruction
  output: लिहा
  forms:
    form:
      task: hello
      name: standard
      source:
        (line: 'प्रमाणित आउटपुटवर “{{message}}” हा मजकूर लिहा आणि त्यानंतर नवीन ओळ द्या.')
    form:
      task: write-text
      name: standard
      source:
        (line: 'प्रमाणित आउटपुटवर “{{message}}” हा मजकूर लिहा आणि शेवटी नवीन ओळ जोडू नका.')
    form:
      task: gcd-function
      name: standard
      source:
        (line: '−{{max}} ते {{max}} या दोन्ही सीमांसह दोन पूर्णांक घ्या आणि त्यांची निरपेक्ष मूल्ये घ्या.')
        (line: 'दुसरे मूल्य धन असताना जोडीच्या जागी दुसरे मूल्य आणि पहिल्या मूल्याला दुसऱ्याने भागल्यावर उरलेली बाकी ठेवा. पहिले मूल्य परत करा.')
    form:
      task: greatest-common-divisor
      name: standard
      source:
        (line: 'डावीकडील मूल्य {{left}} आणि उजवीकडील मूल्य {{right}} ठेवा.')
        (line: 'उजवीकडील मूल्य शून्य नसेपर्यंत दोन्ही मूल्ये एकाच वेळी बदला: नवीन डावे मूल्य म्हणजे जुने उजवे मूल्य आणि नवीन उजवे मूल्य म्हणजे जुन्या डाव्या मूल्याला जुन्या उजव्या मूल्याने भागल्यावर उरलेली बाकी.')
        (line: 'डावीकडील मूल्य दशमान पद्धतीने प्रमाणित आउटपुटवर लिहा आणि नंतर नवीन ओळ द्या.')
    form:
      task: fizz-buzz
      name: standard
      source:
        (line: '1 ते {{limit}} हे दोन्ही टोकांसह सर्व पूर्णांक चढत्या क्रमाने घ्या.')
        (line: 'संख्येला 3 आणि 5 या दोन्हींनी निःशेष भाग जात असेल तर FizzBuzz, फक्त 3 ने तर Fizz, फक्त 5 ने तर Buzz, अन्यथा दशमान पद्धतीने ती संख्या लिहा.')
        (line: 'प्रत्येक निकाल प्रमाणित आउटपुटवर स्वतंत्र ओळीत लिहा.')

profile:
  id: te
  label: Telugu
  kind: natural-language
  comment: '#'
  call: instruction
  output: రాయండి
  forms:
    form:
      task: hello
      name: standard
      source:
        (line: 'ప్రామాణిక అవుట్‌పుట్‌కు “{{message}}” అనే పాఠ్యాన్ని రాసి, తర్వాత కొత్త పంక్తిని రాయండి.')
    form:
      task: write-text
      name: standard
      source:
        (line: '“{{message}}” అనే పాఠ్యాన్ని చివర కొత్త పంక్తిని జోడించకుండా ప్రామాణిక అవుట్‌పుట్‌కు రాయండి.')
    form:
      task: gcd-function
      name: standard
      source:
        (line: '−{{max}} నుంచి {{max}} వరకు రెండు హద్దులతో సహా రెండు పూర్ణాంకాలను తీసుకొని వాటి నిరపేక్ష విలువలను తీసుకోండి.')
        (line: 'రెండవ విలువ ధనాత్మకంగా ఉన్నంతవరకు జత స్థానంలో రెండవ విలువను, మొదటి విలువను రెండవ విలువతో భాగించిన శేషాన్ని ఉంచండి. మొదటి విలువను తిరిగి ఇవ్వండి.')
    form:
      task: greatest-common-divisor
      name: standard
      source:
        (line: 'ఎడమ విలువను {{left}}గా, కుడి విలువను {{right}}గా సెట్ చేయండి.')
        (line: 'కుడి విలువ సున్నా కానంతవరకు రెండు విలువలను ఒకేసారి మార్చండి: కొత్త ఎడమ విలువ పాత కుడి విలువ, కొత్త కుడి విలువ పాత ఎడమ విలువను పాత కుడి విలువతో భాగించినప్పుడు వచ్చే శేషం.')
        (line: 'ఎడమ విలువను దశాంశ రూపంలో ప్రామాణిక అవుట్‌పుట్‌కు రాసి, తర్వాత కొత్త పంక్తిని రాయండి.')
    form:
      task: fizz-buzz
      name: standard
      source:
        (line: '1 నుంచి {{limit}} వరకు రెండు చివరలతో సహా ప్రతి పూర్ణాంకాన్ని ఆరోహణ క్రమంలో తీసుకోండి.')
        (line: 'సంఖ్య 3 మరియు 5 రెండింటితో భాగించబడితే FizzBuzz, 3తో మాత్రమే భాగించబడితే Fizz, 5తో మాత్రమే భాగించబడితే Buzz, లేకపోతే సంఖ్యను దశాంశ రూపంలో రాయండి.')
        (line: 'ప్రతి ఫలితాన్ని ప్రామాణిక అవుట్‌పుట్‌లో వేరే పంక్తిలో రాయండి.')

profile:
  id: tr
  label: Turkish
  kind: natural-language
  comment: '#'
  call: instruction
  output: Yaz
  forms:
    form:
      task: hello
      name: standard
      source:
        (line: 'Standart çıktıya “{{message}}” metnini yaz, ardından bir satır sonu yaz.')
    form:
      task: write-text
      name: standard
      source:
        (line: '“{{message}}” metnini sonuna yeni satır eklemeden standart çıktıya yaz.')
    form:
      task: gcd-function
      name: standard
      source:
        (line: '−{{max}} ile {{max}} arasındaki iki tam sayıyı, sınırlar dahil, al ve mutlak değerlerini hesapla.')
        (line: 'İkinci değer pozitif olduğu sürece çifti ikinci değer ve birinci değerin ikinci değere bölümünden kalan ile değiştir. Birinci değeri döndür.')
    form:
      task: greatest-common-divisor
      name: standard
      source:
        (line: 'Sol değeri {{left}}, sağ değeri {{right}} olarak belirle.')
        (line: 'Sağ değer sıfır olmadığı sürece her iki değeri aynı anda değiştir: yeni sol değer eski sağ değer, yeni sağ değer ise eski sol değerin eski sağ değere bölümünden kalandır.')
        (line: 'Sol değeri ondalık gösterimle standart çıktıya yaz ve ardından bir satır sonu yaz.')
    form:
      task: fizz-buzz
      name: standard
      source:
        (line: '1 ile {{limit}} arasındaki bütün tam sayıları, uçlar dâhil, artan sırada işle.')
        (line: 'Her sayı için hem 3 hem 5 ile bölünüyorsa FizzBuzz, yalnızca 3 ile bölünüyorsa Fizz, yalnızca 5 ile bölünüyorsa Buzz, aksi halde sayıyı ondalık gösterimle yaz.')
        (line: 'Her sonucu standart çıktıda ayrı bir satıra yaz.')

profile:
  id: ta
  label: Tamil
  kind: natural-language
  comment: '#'
  call: instruction
  output: எழுதவும்
  forms:
    form:
      task: hello
      name: standard
      source:
        (line: '“{{message}}” என்ற உரையை நிலையான வெளியீட்டில் எழுதி, பிறகு ஒரு புதிய வரியை எழுதவும்.')
    form:
      task: write-text
      name: standard
      source:
        (line: '“{{message}}” என்ற உரையை முடிவில் புதிய வரியைச் சேர்க்காமல் தரநிலை வெளியீட்டில் எழுது.')
    form:
      task: gcd-function
      name: standard
      source:
        (line: '−{{max}} முதல் {{max}} வரையிலான இரண்டு முழு எண்களை எல்லைகளையும் சேர்த்து ஏற்று, அவற்றின் தனி மதிப்புகளை எடு.')
        (line: 'இரண்டாம் மதிப்பு நேர்மமாக இருக்கும்வரை, இந்த இணையை இரண்டாம் மதிப்பாலும் முதல் மதிப்பை இரண்டாம் மதிப்பால் வகுத்த மீதியாலும் மாற்று. முதல் மதிப்பைத் திருப்பிக் கொடு.')
    form:
      task: greatest-common-divisor
      name: standard
      source:
        (line: 'இடது மதிப்பை {{left}} ஆகவும் வலது மதிப்பை {{right}} ஆகவும் அமைக்கவும்.')
        (line: 'வலது மதிப்பு பூச்சியமாக இல்லாத வரை இரு மதிப்புகளையும் ஒரே நேரத்தில் மாற்றவும்: புதிய இடது மதிப்பு பழைய வலது மதிப்பு; புதிய வலது மதிப்பு பழைய இடது மதிப்பைப் பழைய வலது மதிப்பால் வகுக்கும்போது கிடைக்கும் மீதி.')
        (line: 'இடது மதிப்பைப் பதின்ம வடிவில் நிலையான வெளியீட்டில் எழுதி, பிறகு ஒரு புதிய வரியை எழுதவும்.')
    form:
      task: fizz-buzz
      name: standard
      source:
        (line: '1 முதல் {{limit}} வரை இரு எல்லைகளையும் சேர்த்து அனைத்து முழு எண்களையும் ஏறுவரிசையில் எடுத்துக்கொள்ளவும்.')
        (line: 'எண் 3 மற்றும் 5 இரண்டாலும் வகுபட்டால் FizzBuzz, 3 ஆல் மட்டும் வகுபட்டால் Fizz, 5 ஆல் மட்டும் வகுபட்டால் Buzz, இல்லையெனில் எண்ணைப் பதின்ம வடிவில் எழுதவும்.')
        (line: 'ஒவ்வொரு முடிவையும் நிலையான வெளியீட்டில் தனித்தனி வரியில் எழுதவும்.')

profile:
  id: vi
  label: Vietnamese
  kind: natural-language
  comment: '#'
  call: instruction
  output: Ghi
  forms:
    form:
      task: hello
      name: standard
      source:
        (line: 'Ghi văn bản “{{message}}” ra đầu ra chuẩn, rồi ghi một ký tự xuống dòng.')
    form:
      task: write-text
      name: standard
      source:
        (line: 'Ghi văn bản “{{message}}” ra đầu ra chuẩn mà không thêm ký tự xuống dòng.')
    form:
      task: gcd-function
      name: standard
      source:
        (line: 'Nhận hai số nguyên từ −{{max}} đến {{max}}, kể cả hai đầu, rồi lấy giá trị tuyệt đối của chúng.')
        (line: 'Khi giá trị thứ hai còn dương, thay cặp bằng giá trị thứ hai và số dư của phép chia giá trị thứ nhất cho giá trị thứ hai. Trả về giá trị thứ nhất.')
    form:
      task: greatest-common-divisor
      name: standard
      source:
        (line: 'Đặt giá trị bên trái thành {{left}} và giá trị bên phải thành {{right}}.')
        (line: 'Chừng nào giá trị bên phải khác không, hãy thay đồng thời cả hai giá trị: giá trị trái mới là giá trị phải cũ và giá trị phải mới là phần dư khi chia giá trị trái cũ cho giá trị phải cũ.')
        (line: 'Ghi giá trị bên trái ở dạng thập phân ra đầu ra chuẩn, rồi ghi một ký tự xuống dòng.')
    form:
      task: fizz-buzz
      name: standard
      source:
        (line: 'Duyệt lần lượt các số nguyên từ 1 đến {{limit}}, kể cả hai đầu, theo thứ tự tăng dần.')
        (line: 'Với mỗi số, ghi FizzBuzz nếu chia hết cho cả 3 và 5, Fizz nếu chỉ chia hết cho 3, Buzz nếu chỉ chia hết cho 5, hoặc chính số đó ở dạng thập phân trong trường hợp còn lại.')
        (line: 'Ghi mỗi kết quả trên một dòng riêng ở đầu ra chuẩn.')

profile:
  id: ko
  label: Korean
  kind: natural-language
  comment: '#'
  call: instruction
  output: 쓴다
  forms:
    form:
      task: hello
      name: standard
      source:
        (line: '표준 출력에 텍스트 “{{message}}”를 쓰고 줄을 바꾼다.')
    form:
      task: write-text
      name: standard
      source:
        (line: '텍스트 “{{message}}”를 끝에 줄바꿈을 추가하지 않고 표준 출력에 쓴다.')
    form:
      task: gcd-function
      name: standard
      source:
        (line: '−{{max}} 이상 {{max}} 이하의 정수 두 개를 받아 각각의 절댓값을 구한다.')
        (line: '두 번째 값이 양수인 동안 두 번째 값과 첫 번째 값을 두 번째 값으로 나눈 나머지로 쌍을 바꾼다. 첫 번째 값을 반환한다.')
    form:
      task: greatest-common-divisor
      name: standard
      source:
        (line: '왼쪽 값을 {{left}}로, 오른쪽 값을 {{right}}로 설정한다.')
        (line: '오른쪽 값이 0이 아닌 동안 두 값을 동시에 바꾼다. 새 왼쪽 값은 이전 오른쪽 값이고, 새 오른쪽 값은 이전 왼쪽 값을 이전 오른쪽 값으로 나눈 나머지다.')
        (line: '왼쪽 값을 십진수로 표준 출력에 쓰고 줄을 바꾼다.')
    form:
      task: fizz-buzz
      name: standard
      source:
        (line: '1부터 {{limit}}까지 양 끝을 포함한 모든 정수를 오름차순으로 처리한다.')
        (line: '3과 5 모두로 나누어떨어지면 FizzBuzz, 3으로만 나누어떨어지면 Fizz, 5로만 나누어떨어지면 Buzz, 그 외에는 정수를 십진수로 쓴다.')
        (line: '각 결과를 표준 출력에 한 줄씩 쓴다.')
`;
