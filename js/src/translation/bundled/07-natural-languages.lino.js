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
      task: empty-program
      name: standard
      fixed:
        status: 0
      source:
        (line: 'Exit with status 0 without writing to standard output or standard error.')
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
      task: ackermann-value
      name: standard
      source:
        (line: 'Write the Ackermann value A({{left}},{{right}}) in decimal to standard output, followed by a newline.')
    form:
      task: ackermann-function
      name: standard
      source:
        (line: 'Return the Ackermann value A(m,n) for integer inputs 0 ≤ m ≤ {{left}} and 0 ≤ n ≤ {{right}}. Define A(0,n)=n+1, A(m,0)=A(m−1,1) for m>0, and A(m,n)=A(m−1,A(m,n−1)) when both are positive.')
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
    form:
      task: fizz-buzz-lowercase
      name: standard
      source:
        (line: 'Visit each integer from 1 through {{limit}}, in ascending order.')
        (line: 'For each integer, write fizzbuzz if it is divisible by both 3 and 5, fizz if it is divisible only by 3, buzz if it is divisible only by 5, or the integer in decimal otherwise.')
        (line: 'Write each result on its own line of standard output.')
    form:
      task: fizz-buzz-quoted
      name: standard
      source:
        (line: 'Visit each integer from 1 through {{limit}}, in ascending order.')
        (line: 'For each integer, write FizzBuzz if it is divisible by both 3 and 5, Fizz if it is divisible only by 3, Buzz if it is divisible only by 5, or the integer in decimal otherwise.')
        (line: 'Write each result on its own line of standard output.')
        (line: 'Enclose each result in ASCII double quotes before writing it.')
    form:
      task: fizz-buzz-lowercase-blank-line
      name: standard
      source:
        (line: 'Visit each integer from 1 through {{limit}}, in ascending order.')
        (line: 'For each integer, write fizzbuzz if it is divisible by both 3 and 5, fizz if it is divisible only by 3, buzz if it is divisible only by 5, or the integer in decimal otherwise.')
        (line: 'Write each result on its own line of standard output.')
        (line: 'Write one additional newline after the last result.')

profile:
  id: zh
  label: 'Mandarin Chinese'
  kind: natural-language
  comment: '#'
  call: instruction
  output: 输出
  forms:
    form:
      task: empty-program
      name: standard
      fixed:
        status: 0
      source:
        (line: '以状态码 0 退出，标准输出和标准错误均保持为空。')
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
      task: ackermann-value
      name: standard
      source:
        (line: '将阿克曼函数值 A({{left}},{{right}}) 以十进制写入标准输出，然后换行。')
    form:
      task: ackermann-function
      name: standard
      source:
        (line: '对于整数输入 0 ≤ m ≤ {{left}} 和 0 ≤ n ≤ {{right}}，返回阿克曼函数 A(m,n) 的值。定义 A(0,n)=n+1；若 m>0，则 A(m,0)=A(m−1,1)；若两者均为正数，则 A(m,n)=A(m−1,A(m,n−1))。')
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
    form:
      task: fizz-buzz-lowercase
      name: standard
      source:
        (line: '按升序遍历从 1 到 {{limit}} 的每个整数，包括两端。')
        (line: '对每个整数，若能同时被 3 和 5 整除则输出 fizzbuzz；若只能被 3 整除则输出 fizz；若只能被 5 整除则输出 buzz；否则输出该整数的十进制表示。')
        (line: 将每个结果各占一行写入标准输出。)
    form:
      task: fizz-buzz-quoted
      name: standard
      source:
        (line: '按升序遍历从 1 到 {{limit}} 的每个整数，包括两端。')
        (line: '对每个整数，若能同时被 3 和 5 整除则输出 FizzBuzz；若只能被 3 整除则输出 Fizz；若只能被 5 整除则输出 Buzz；否则输出该整数的十进制表示。')
        (line: 将每个结果各占一行写入标准输出。)
        (line: '写入前用 ASCII 双引号括住每个结果。')
    form:
      task: fizz-buzz-lowercase-blank-line
      name: standard
      source:
        (line: '按升序遍历从 1 到 {{limit}} 的每个整数，包括两端。')
        (line: '对每个整数，若能同时被 3 和 5 整除则输出 fizzbuzz；若只能被 3 整除则输出 fizz；若只能被 5 整除则输出 buzz；否则输出该整数的十进制表示。')
        (line: 将每个结果各占一行写入标准输出。)
        (line: 在最后一个结果之后再写一个换行符。)

profile:
  id: hi
  label: Hindi
  kind: natural-language
  comment: '#'
  call: instruction
  output: लिखें
  forms:
    form:
      task: empty-program
      name: standard
      fixed:
        status: 0
      source:
        (line: 'मानक आउटपुट और मानक त्रुटि में कुछ लिखे बिना स्थिति कोड 0 के साथ समाप्त करें।')
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
      task: ackermann-value
      name: standard
      source:
        (line: 'एकरमान फलन का मान A({{left}},{{right}}) दशमलव में मानक आउटपुट पर लिखें और नई पंक्ति जोड़ें।')
    form:
      task: ackermann-function
      name: standard
      source:
        (line: 'पूर्णांक इनपुट 0 ≤ m ≤ {{left}} और 0 ≤ n ≤ {{right}} के लिए एकरमान फलन A(m,n) का मान लौटाएँ। A(0,n)=n+1 रखें। m>0 पर A(m,0)=A(m−1,1) और दोनों धनात्मक होने पर A(m,n)=A(m−1,A(m,n−1)) रखें।')
    form:
      task: gcd-function
      name: standard
      source:
        (line: '−{{max}} से {{max}} तक के दो पूर्णांक लें, दोनों सीमाएँ शामिल हैं, और उनके निरपेक्ष मान लें।')
        (line: 'जब तक दूसरा मान धनात्मक है, दोनों मानों को क्रमशः दूसरे मान और प्रथम मान को दूसरे से भाग देने पर बचे शेषफल से बदलें। पहला मान लौटाएँ।')
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
    form:
      task: fizz-buzz-lowercase
      name: standard
      source:
        (line: '1 से {{limit}} तक, दोनों सिरों समेत, सभी पूर्णांक बढ़ते क्रम में लें।')
        (line: 'यदि संख्या 3 और 5 दोनों से विभाज्य है तो fizzbuzz, केवल 3 से तो fizz, केवल 5 से तो buzz, अन्यथा संख्या को दशमलव में लिखें।')
        (line: 'हर परिणाम को मानक आउटपुट पर अलग पंक्ति में लिखें।')
    form:
      task: fizz-buzz-quoted
      name: standard
      source:
        (line: '1 से {{limit}} तक, दोनों सिरों समेत, सभी पूर्णांक बढ़ते क्रम में लें।')
        (line: 'यदि संख्या 3 और 5 दोनों से विभाज्य है तो FizzBuzz, केवल 3 से तो Fizz, केवल 5 से तो Buzz, अन्यथा संख्या को दशमलव में लिखें।')
        (line: 'हर परिणाम को मानक आउटपुट पर अलग पंक्ति में लिखें।')
        (line: 'हर परिणाम को ASCII के दोहरे उद्धरण चिह्नों में रखकर लिखें।')
    form:
      task: fizz-buzz-lowercase-blank-line
      name: standard
      source:
        (line: '1 से {{limit}} तक, दोनों सिरों समेत, सभी पूर्णांक बढ़ते क्रम में लें।')
        (line: 'यदि संख्या 3 और 5 दोनों से विभाज्य है तो fizzbuzz, केवल 3 से तो fizz, केवल 5 से तो buzz, अन्यथा संख्या को दशमलव में लिखें।')
        (line: 'हर परिणाम को मानक आउटपुट पर अलग पंक्ति में लिखें।')
        (line: 'अंतिम परिणाम के बाद एक और नई पंक्ति लिखें।')

profile:
  id: es
  label: Spanish
  kind: natural-language
  comment: '#'
  call: instruction
  output: Escribe
  forms:
    form:
      task: empty-program
      name: standard
      fixed:
        status: 0
      source:
        (line: 'Termine con código 0 sin escribir en la salida estándar ni en la salida de error estándar.')
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
      task: ackermann-value
      name: standard
      source:
        (line: 'Escribe el valor de Ackermann A({{left}},{{right}}) en decimal en la salida estándar, seguido de un salto de línea.')
    form:
      task: ackermann-function
      name: standard
      source:
        (line: 'Devuelve el valor de Ackermann A(m,n) para los enteros 0 ≤ m ≤ {{left}} y 0 ≤ n ≤ {{right}}. Define A(0,n)=n+1, A(m,0)=A(m−1,1) si m>0 y A(m,n)=A(m−1,A(m,n−1)) si ambos son positivos.')
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
    form:
      task: fizz-buzz-lowercase
      name: standard
      source:
        (line: 'Recorre en orden ascendente los enteros de 1 a {{limit}}, ambos inclusive.')
        (line: 'Para cada entero, escribe fizzbuzz si es divisible por 3 y 5, fizz si solo es divisible por 3, buzz si solo es divisible por 5 o el entero en decimal en los demás casos.')
        (line: 'Escribe cada resultado en una línea de la salida estándar.')
    form:
      task: fizz-buzz-quoted
      name: standard
      source:
        (line: 'Recorre en orden ascendente los enteros de 1 a {{limit}}, ambos inclusive.')
        (line: 'Para cada entero, escribe FizzBuzz si es divisible por 3 y 5, Fizz si solo es divisible por 3, Buzz si solo es divisible por 5 o el entero en decimal en los demás casos.')
        (line: 'Escribe cada resultado en una línea de la salida estándar.')
        (line: 'Encierra cada resultado entre comillas dobles ASCII antes de escribirlo.')
    form:
      task: fizz-buzz-lowercase-blank-line
      name: standard
      source:
        (line: 'Recorre en orden ascendente los enteros de 1 a {{limit}}, ambos inclusive.')
        (line: 'Para cada entero, escribe fizzbuzz si es divisible por 3 y 5, fizz si solo es divisible por 3, buzz si solo es divisible por 5 o el entero en decimal en los demás casos.')
        (line: 'Escribe cada resultado en una línea de la salida estándar.')
        (line: 'Escribe un salto de línea adicional después del último resultado.')

profile:
  id: fr
  label: French
  kind: natural-language
  comment: '#'
  call: instruction
  output: Écris
  forms:
    form:
      task: empty-program
      name: standard
      fixed:
        status: 0
      source:
        (line: 'Terminez avec le code 0 en laissant la sortie standard et la sortie d’erreur standard vides.')
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
      task: ackermann-value
      name: standard
      source:
        (line: 'Écrire la valeur d’Ackermann A({{left}},{{right}}) en décimal sur la sortie standard, suivie d’un saut de ligne.')
    form:
      task: ackermann-function
      name: standard
      source:
        (line: 'Renvoyer la valeur de la fonction d’Ackermann A(m,n) pour les entiers 0 ≤ m ≤ {{left}} et 0 ≤ n ≤ {{right}}. Poser A(0,n)=n+1, A(m,0)=A(m−1,1) si m>0 et A(m,n)=A(m−1,A(m,n−1)) si les deux sont positifs.')
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
    form:
      task: fizz-buzz-lowercase
      name: standard
      source:
        (line: 'Parcours les entiers de 1 à {{limit}} inclus, dans l’ordre croissant.')
        (line: 'Pour chaque entier, écris fizzbuzz s’il est divisible par 3 et par 5, fizz s’il est divisible par 3 seulement, buzz s’il est divisible par 5 seulement, ou l’entier en décimal sinon.')
        (line: 'Écris chaque résultat sur une ligne de la sortie standard.')
    form:
      task: fizz-buzz-quoted
      name: standard
      source:
        (line: 'Parcours les entiers de 1 à {{limit}} inclus, dans l’ordre croissant.')
        (line: 'Pour chaque entier, écris FizzBuzz s’il est divisible par 3 et par 5, Fizz s’il est divisible par 3 seulement, Buzz s’il est divisible par 5 seulement, ou l’entier en décimal sinon.')
        (line: 'Écris chaque résultat sur une ligne de la sortie standard.')
        (line: 'Entoure chaque résultat de guillemets droits doubles ASCII avant de l’écrire.')
    form:
      task: fizz-buzz-lowercase-blank-line
      name: standard
      source:
        (line: 'Parcours les entiers de 1 à {{limit}} inclus, dans l’ordre croissant.')
        (line: 'Pour chaque entier, écris fizzbuzz s’il est divisible par 3 et par 5, fizz s’il est divisible par 3 seulement, buzz s’il est divisible par 5 seulement, ou l’entier en décimal sinon.')
        (line: 'Écris chaque résultat sur une ligne de la sortie standard.')
        (line: 'Écris un saut de ligne supplémentaire après le dernier résultat.')

profile:
  id: ar
  label: 'Standard Arabic'
  kind: natural-language
  comment: '#'
  call: instruction
  output: اكتب
  forms:
    form:
      task: empty-program
      name: standard
      fixed:
        status: 0
      source:
        (line: 'أنه البرنامج بالحالة 0 من دون الكتابة إلى المخرجات القياسية أو مخرجات الخطأ القياسية.')
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
      task: ackermann-value
      name: standard
      source:
        (line: 'اكتب قيمة أكرمان A({{left}},{{right}}) بالصيغة العشرية على المخرج القياسي، ثم أضف سطرًا جديدًا.')
    form:
      task: ackermann-function
      name: standard
      source:
        (line: 'أعد قيمة دالة أكرمان A(m,n) للمدخلين الصحيحين 0 ≤ m ≤ {{left}} و0 ≤ n ≤ {{right}}. عرّف A(0,n)=n+1، وA(m,0)=A(m−1,1) عندما m>0، وA(m,n)=A(m−1,A(m,n−1)) عندما يكون كلاهما موجبًا.')
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
    form:
      task: fizz-buzz-lowercase
      name: standard
      source:
        (line: 'مرّ بالأعداد الصحيحة من 1 إلى {{limit}} شاملًا الطرفين وبترتيب تصاعدي.')
        (line: 'لكل عدد، اكتب fizzbuzz إن قبل القسمة على 3 و5 معًا، وfizz إن قبل القسمة على 3 فقط، وbuzz إن قبل القسمة على 5 فقط، وإلا فاكتب العدد بالنظام العشري.')
        (line: 'اكتب كل نتيجة في سطر مستقل على المخرج القياسي.')
    form:
      task: fizz-buzz-quoted
      name: standard
      source:
        (line: 'مرّ بالأعداد الصحيحة من 1 إلى {{limit}} شاملًا الطرفين وبترتيب تصاعدي.')
        (line: 'لكل عدد، اكتب FizzBuzz إن قبل القسمة على 3 و5 معًا، وFizz إن قبل القسمة على 3 فقط، وBuzz إن قبل القسمة على 5 فقط، وإلا فاكتب العدد بالنظام العشري.')
        (line: 'اكتب كل نتيجة في سطر مستقل على المخرج القياسي.')
        (line: 'ضع كل نتيجة بين علامتي اقتباس مزدوجتين من ASCII قبل كتابتها.')
    form:
      task: fizz-buzz-lowercase-blank-line
      name: standard
      source:
        (line: 'مرّ بالأعداد الصحيحة من 1 إلى {{limit}} شاملًا الطرفين وبترتيب تصاعدي.')
        (line: 'لكل عدد، اكتب fizzbuzz إن قبل القسمة على 3 و5 معًا، وfizz إن قبل القسمة على 3 فقط، وbuzz إن قبل القسمة على 5 فقط، وإلا فاكتب العدد بالنظام العشري.')
        (line: 'اكتب كل نتيجة في سطر مستقل على المخرج القياسي.')
        (line: 'اكتب محرف سطر جديد إضافيًا بعد النتيجة الأخيرة.')

profile:
  id: bn
  label: Bengali
  kind: natural-language
  comment: '#'
  call: instruction
  output: লিখুন
  forms:
    form:
      task: empty-program
      name: standard
      fixed:
        status: 0
      source:
        (line: 'মানক আউটপুট বা মানক ত্রুটি প্রবাহে কিছু না লিখে স্ট্যাটাস কোড 0 দিয়ে প্রস্থান করুন।')
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
      task: ackermann-value
      name: standard
      source:
        (line: 'আকারম্যানের মান A({{left}},{{right}}) দশমিক আকারে মানক আউটপুটে লিখুন এবং শেষে একটি নতুন লাইন দিন।')
    form:
      task: ackermann-function
      name: standard
      source:
        (line: 'পূর্ণসংখ্যা ইনপুট 0 ≤ m ≤ {{left}} এবং 0 ≤ n ≤ {{right}} হলে আকারম্যান ফাংশন A(m,n) এর মান ফেরত দিন। A(0,n)=n+1, m>0 হলে A(m,0)=A(m−1,1), এবং উভয়ই ধনাত্মক হলে A(m,n)=A(m−1,A(m,n−1))।')
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
    form:
      task: fizz-buzz-lowercase
      name: standard
      source:
        (line: '1 থেকে {{limit}} পর্যন্ত উভয় প্রান্তসহ প্রতিটি পূর্ণসংখ্যা ঊর্ধ্বক্রমে নিন।')
        (line: 'সংখ্যাটি 3 ও 5 উভয়টি দিয়ে বিভাজ্য হলে fizzbuzz, শুধু 3 দিয়ে হলে fizz, শুধু 5 দিয়ে হলে buzz, অন্যথায় দশমিক সংখ্যাটি লিখুন।')
        (line: 'প্রতিটি ফল মানক আউটপুটে আলাদা লাইনে লিখুন।')
    form:
      task: fizz-buzz-quoted
      name: standard
      source:
        (line: '1 থেকে {{limit}} পর্যন্ত উভয় প্রান্তসহ প্রতিটি পূর্ণসংখ্যা ঊর্ধ্বক্রমে নিন।')
        (line: 'সংখ্যাটি 3 ও 5 উভয়টি দিয়ে বিভাজ্য হলে FizzBuzz, শুধু 3 দিয়ে হলে Fizz, শুধু 5 দিয়ে হলে Buzz, অন্যথায় দশমিক সংখ্যাটি লিখুন।')
        (line: 'প্রতিটি ফল মানক আউটপুটে আলাদা লাইনে লিখুন।')
        (line: 'লেখার আগে প্রতিটি ফল ASCII দ্বৈত উদ্ধৃতি চিহ্নের মধ্যে রাখুন।')
    form:
      task: fizz-buzz-lowercase-blank-line
      name: standard
      source:
        (line: '1 থেকে {{limit}} পর্যন্ত উভয় প্রান্তসহ প্রতিটি পূর্ণসংখ্যা ঊর্ধ্বক্রমে নিন।')
        (line: 'সংখ্যাটি 3 ও 5 উভয়টি দিয়ে বিভাজ্য হলে fizzbuzz, শুধু 3 দিয়ে হলে fizz, শুধু 5 দিয়ে হলে buzz, অন্যথায় দশমিক সংখ্যাটি লিখুন।')
        (line: 'প্রতিটি ফল মানক আউটপুটে আলাদা লাইনে লিখুন।')
        (line: 'শেষ ফলের পরে আরও একটি নতুন লাইন লিখুন।')

profile:
  id: pt
  label: Portuguese
  kind: natural-language
  comment: '#'
  call: instruction
  output: Escreva
  forms:
    form:
      task: empty-program
      name: standard
      fixed:
        status: 0
      source:
        (line: 'Termine com o código 0 sem escrever na saída padrão nem na saída de erro padrão.')
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
      task: ackermann-value
      name: standard
      source:
        (line: 'Escreva o valor de Ackermann A({{left}},{{right}}) em decimal na saída padrão e acrescente uma quebra de linha.')
    form:
      task: ackermann-function
      name: standard
      source:
        (line: 'Retorne o valor de Ackermann A(m,n) para os inteiros 0 ≤ m ≤ {{left}} e 0 ≤ n ≤ {{right}}. Defina A(0,n)=n+1, A(m,0)=A(m−1,1) se m>0 e A(m,n)=A(m−1,A(m,n−1)) se ambos forem positivos.')
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
    form:
      task: fizz-buzz-lowercase
      name: standard
      source:
        (line: 'Percorra em ordem crescente todos os inteiros de 1 a {{limit}}, inclusive.')
        (line: 'Para cada inteiro, escreva fizzbuzz se for divisível por 3 e 5, fizz se for divisível apenas por 3, buzz se for divisível apenas por 5 ou o inteiro em decimal nos demais casos.')
        (line: 'Escreva cada resultado em sua própria linha na saída padrão.')
    form:
      task: fizz-buzz-quoted
      name: standard
      source:
        (line: 'Percorra em ordem crescente todos os inteiros de 1 a {{limit}}, inclusive.')
        (line: 'Para cada inteiro, escreva FizzBuzz se for divisível por 3 e 5, Fizz se for divisível apenas por 3, Buzz se for divisível apenas por 5 ou o inteiro em decimal nos demais casos.')
        (line: 'Escreva cada resultado em sua própria linha na saída padrão.')
        (line: 'Coloque cada resultado entre aspas duplas ASCII antes de escrevê-lo.')
    form:
      task: fizz-buzz-lowercase-blank-line
      name: standard
      source:
        (line: 'Percorra em ordem crescente todos os inteiros de 1 a {{limit}}, inclusive.')
        (line: 'Para cada inteiro, escreva fizzbuzz se for divisível por 3 e 5, fizz se for divisível apenas por 3, buzz se for divisível apenas por 5 ou o inteiro em decimal nos demais casos.')
        (line: 'Escreva cada resultado em sua própria linha na saída padrão.')
        (line: 'Escreva mais uma quebra de linha após o último resultado.')

profile:
  id: ru
  label: Russian
  kind: natural-language
  comment: '#'
  call: instruction
  output: Выведите
  forms:
    form:
      task: empty-program
      name: standard
      fixed:
        status: 0
      source:
        (line: 'Завершите программу с кодом 0, оставив стандартный вывод и стандартный поток ошибок пустыми.')
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
      task: ackermann-value
      name: standard
      source:
        (line: 'Выведите значение функции Аккермана A({{left}},{{right}}) в десятичном виде в стандартный поток вывода, затем переведите строку.')
    form:
      task: ackermann-function
      name: standard
      source:
        (line: 'Верните значение функции Аккермана A(m,n) для целых чисел 0 ≤ m ≤ {{left}} и 0 ≤ n ≤ {{right}}. Положите A(0,n)=n+1, A(m,0)=A(m−1,1) при m>0 и A(m,n)=A(m−1,A(m,n−1)), когда оба числа положительны.')
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
    form:
      task: fizz-buzz-lowercase
      name: standard
      source:
        (line: 'Переберите по возрастанию все целые числа от 1 до {{limit}} включительно.')
        (line: 'Для каждого числа выведите fizzbuzz, если оно делится на 3 и 5, fizz, если делится только на 3, buzz, если делится только на 5, иначе выведите число в десятичной записи.')
        (line: 'Выведите каждый результат в отдельной строке стандартного потока вывода.')
    form:
      task: fizz-buzz-quoted
      name: standard
      source:
        (line: 'Переберите по возрастанию все целые числа от 1 до {{limit}} включительно.')
        (line: 'Для каждого числа выведите FizzBuzz, если оно делится на 3 и 5, Fizz, если делится только на 3, Buzz, если делится только на 5, иначе выведите число в десятичной записи.')
        (line: 'Выведите каждый результат в отдельной строке стандартного потока вывода.')
        (line: 'Перед записью заключите каждый результат в двойные кавычки ASCII.')
    form:
      task: fizz-buzz-lowercase-blank-line
      name: standard
      source:
        (line: 'Переберите по возрастанию все целые числа от 1 до {{limit}} включительно.')
        (line: 'Для каждого числа выведите fizzbuzz, если оно делится на 3 и 5, fizz, если делится только на 3, buzz, если делится только на 5, иначе выведите число в десятичной записи.')
        (line: 'Выведите каждый результат в отдельной строке стандартного потока вывода.')
        (line: 'После последнего результата выведите дополнительный перевод строки.')

profile:
  id: ur
  label: Urdu
  kind: natural-language
  comment: '#'
  call: instruction
  output: لکھیں
  forms:
    form:
      task: empty-program
      name: standard
      fixed:
        status: 0
      source:
        (line: 'معیاری آؤٹ پٹ اور معیاری خرابی کے دھارے میں کچھ لکھے بغیر کوڈ 0 کے ساتھ پروگرام ختم کریں۔')
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
      task: ackermann-value
      name: standard
      source:
        (line: 'ایکرمین تفاعل کی قدر A({{left}},{{right}}) معیاری آؤٹ پٹ پر عشری صورت میں لکھیں اور نئی سطر شامل کریں۔')
    form:
      task: ackermann-function
      name: standard
      source:
        (line: 'صحیح عددی مدخلات 0 ≤ m ≤ {{left}} اور 0 ≤ n ≤ {{right}} کے لیے ایکرمین تفاعل A(m,n) کی قدر واپس کریں۔ A(0,n)=n+1 مقرر کریں، m>0 پر A(m,0)=A(m−1,1) اور دونوں کے مثبت ہونے پر A(m,n)=A(m−1,A(m,n−1)) رکھیں۔')
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
    form:
      task: fizz-buzz-lowercase
      name: standard
      source:
        (line: '1 سے {{limit}} تک ہر صحیح عدد کو بڑھتی ترتیب میں لیں، دونوں سروں سمیت۔')
        (line: 'جو عدد 3 اور 5 دونوں سے تقسیم ہو اس کے لیے fizzbuzz، صرف 3 سے ہو تو fizz، صرف 5 سے ہو تو buzz، ورنہ اعشاری صورت میں خود عدد لکھیں۔')
        (line: 'ہر نتیجہ معیاری خروج پر ایک الگ سطر میں لکھیں۔')
    form:
      task: fizz-buzz-quoted
      name: standard
      source:
        (line: '1 سے {{limit}} تک ہر صحیح عدد کو بڑھتی ترتیب میں لیں، دونوں سروں سمیت۔')
        (line: 'جو عدد 3 اور 5 دونوں سے تقسیم ہو اس کے لیے FizzBuzz، صرف 3 سے ہو تو Fizz، صرف 5 سے ہو تو Buzz، ورنہ اعشاری صورت میں خود عدد لکھیں۔')
        (line: 'ہر نتیجہ معیاری خروج پر ایک الگ سطر میں لکھیں۔')
        (line: 'لکھنے سے پہلے ہر نتیجے کو ASCII کے دہرے واوین میں رکھیں۔')
    form:
      task: fizz-buzz-lowercase-blank-line
      name: standard
      source:
        (line: '1 سے {{limit}} تک ہر صحیح عدد کو بڑھتی ترتیب میں لیں، دونوں سروں سمیت۔')
        (line: 'جو عدد 3 اور 5 دونوں سے تقسیم ہو اس کے لیے fizzbuzz، صرف 3 سے ہو تو fizz، صرف 5 سے ہو تو buzz، ورنہ اعشاری صورت میں خود عدد لکھیں۔')
        (line: 'ہر نتیجہ معیاری خروج پر ایک الگ سطر میں لکھیں۔')
        (line: 'آخری نتیجے کے بعد ایک مزید سطر بدلنے کا حرف لکھیں۔')
`;
