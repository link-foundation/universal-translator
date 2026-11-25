# Adds the interface text of the issue 8 features (detection, partial
# translation, rules editor) to every locale of the web demo catalog.
import sys
path = sys.argv[1]
K = ['auto','autoDetected','allOrNothing','undetected','summary','line','lines',
     'title','intro','sourceTitle','sourceHint','templatesTitle','templatesHint',
     'namesTitle','namesHint','outputTitle','outputHint','anyLanguage','naturalLanguage',
     'chooseLanguage','template','chooseTemplate','wording','language','find','findText',
     'name','replace','replaceText','newName','regex','remove','json','applyJson','add']
T = {
'en': ["Auto-detect","Auto-detect ({language})","All or nothing (no partial translation)","Type a text to detect its language.",
 "{percent}% of the lines translated; these parts could not be translated:","Line {line}:","Lines {line}-{endLine}:",
 "Translation rules","Rules added here apply at their stage of every translation. They are kept in this browser.",
 "Before reading (source text)","Replace text in the source before it is read.",
 "Natural language wordings","More wordings a natural language reads for a template.",
 "Meta program (names)","Rename variables and functions in the meta program.",
 "After writing (target text)","Replace text in the translation after it is written.",
 "Any language","Natural language","Language…","Template","Template…","Wording","Language","Find","find",
 "name","Replace","replace with","new name","Regex","Remove rule","Rules as JSON (import and export)","Apply JSON","Add rule"],
'ru': ["Определить автоматически","Определить автоматически ({language})","Всё или ничего (без частичного перевода)","Введите текст, чтобы определить его язык.",
 "Переведено {percent}% строк; эти части перевести не удалось:","Строка {line}:","Строки {line}-{endLine}:",
 "Правила перевода","Добавленные здесь правила применяются на своём этапе каждого перевода. Они хранятся в этом браузере.",
 "До чтения (исходный текст)","Заменить текст в исходнике до того, как он прочитан.",
 "Формулировки естественного языка","Дополнительные формулировки шаблона, которые читает естественный язык.",
 "Метапрограмма (имена)","Переименовать переменные и функции в метапрограмме.",
 "После записи (текст перевода)","Заменить текст в переводе после того, как он записан.",
 "Любой язык","Естественный язык","Язык…","Шаблон","Шаблон…","Формулировка","Язык","Найти","что найти",
 "имя","Заменить","на что заменить","новое имя","Регулярное выражение","Удалить правило","Правила в JSON (импорт и экспорт)","Применить JSON","Добавить правило"],
'de': ["Automatisch erkennen","Automatisch erkennen ({language})","Alles oder nichts (keine Teilübersetzung)","Geben Sie einen Text ein, um seine Sprache zu erkennen.",
 "{percent} % der Zeilen übersetzt; diese Teile konnten nicht übersetzt werden:","Zeile {line}:","Zeilen {line}-{endLine}:",
 "Übersetzungsregeln","Hier hinzugefügte Regeln gelten in ihrer Stufe jeder Übersetzung. Sie werden in diesem Browser gespeichert.",
 "Vor dem Lesen (Quelltext)","Text in der Quelle ersetzen, bevor sie gelesen wird.",
 "Formulierungen natürlicher Sprachen","Weitere Formulierungen, die eine natürliche Sprache für eine Vorlage liest.",
 "Metaprogramm (Namen)","Variablen und Funktionen im Metaprogramm umbenennen.",
 "Nach dem Schreiben (Zieltext)","Text in der Übersetzung ersetzen, nachdem sie geschrieben wurde.",
 "Jede Sprache","Natürliche Sprache","Sprache…","Vorlage","Vorlage…","Formulierung","Sprache","Suchen","suchen",
 "Name","Ersetzen","ersetzen durch","neuer Name","Regulärer Ausdruck","Regel entfernen","Regeln als JSON (Import und Export)","JSON anwenden","Regel hinzufügen"],
'fr': ["Détection automatique","Détection automatique ({language})","Tout ou rien (pas de traduction partielle)","Saisissez un texte pour détecter sa langue.",
 "{percent} % des lignes traduites ; ces parties n’ont pas pu être traduites :","Ligne {line} :","Lignes {line}-{endLine} :",
 "Règles de traduction","Les règles ajoutées ici s’appliquent à leur étape de chaque traduction. Elles sont conservées dans ce navigateur.",
 "Avant la lecture (texte source)","Remplacer du texte dans la source avant sa lecture.",
 "Formulations des langues naturelles","D’autres formulations qu’une langue naturelle lit pour un modèle.",
 "Méta-programme (noms)","Renommer des variables et des fonctions dans le méta-programme.",
 "Après l’écriture (texte cible)","Remplacer du texte dans la traduction après son écriture.",
 "Toute langue","Langue naturelle","Langue…","Modèle","Modèle…","Formulation","Langue","Chercher","chercher",
 "nom","Remplacer","remplacer par","nouveau nom","Expression régulière","Supprimer la règle","Règles en JSON (import et export)","Appliquer le JSON","Ajouter une règle"],
'es': ["Detectar automáticamente","Detectar automáticamente ({language})","Todo o nada (sin traducción parcial)","Escriba un texto para detectar su idioma.",
 "{percent} % de las líneas traducidas; estas partes no se pudieron traducir:","Línea {line}:","Líneas {line}-{endLine}:",
 "Reglas de traducción","Las reglas añadidas aquí se aplican en su etapa de cada traducción. Se guardan en este navegador.",
 "Antes de leer (texto de origen)","Reemplazar texto en el origen antes de leerlo.",
 "Formulaciones de lenguas naturales","Más formulaciones que una lengua natural lee para una plantilla.",
 "Metaprograma (nombres)","Renombrar variables y funciones en el metaprograma.",
 "Después de escribir (texto de destino)","Reemplazar texto en la traducción después de escribirla.",
 "Cualquier idioma","Lengua natural","Idioma…","Plantilla","Plantilla…","Formulación","Idioma","Buscar","buscar",
 "nombre","Reemplazar","reemplazar por","nuevo nombre","Expresión regular","Eliminar regla","Reglas como JSON (importar y exportar)","Aplicar JSON","Añadir regla"],
'zh': ["自动检测","自动检测（{language}）","全有或全无（不做部分翻译）","输入文本以检测其语言。",
 "已翻译 {percent}% 的行；以下部分无法翻译：","第 {line} 行：","第 {line}-{endLine} 行：",
 "翻译规则","此处添加的规则会在每次翻译的相应阶段生效，并保存在此浏览器中。",
 "读取之前（源文本）","在读取源文本之前替换其中的文本。",
 "自然语言措辞","自然语言为某个模板读取的更多措辞。",
 "元程序（名称）","在元程序中重命名变量和函数。",
 "写出之后（目标文本）","在译文写出之后替换其中的文本。",
 "任意语言","自然语言","语言…","模板","模板…","措辞","语言","查找","查找内容",
 "名称","替换","替换为","新名称","正则表达式","删除规则","JSON 格式的规则（导入和导出）","应用 JSON","添加规则"],
'hi': ["स्वतः पहचानें","स्वतः पहचानें ({language})","सब या कुछ नहीं (आंशिक अनुवाद नहीं)","भाषा पहचानने के लिए कोई पाठ लिखें।",
 "{percent}% पंक्तियों का अनुवाद हुआ; इन हिस्सों का अनुवाद नहीं हो सका:","पंक्ति {line}:","पंक्तियाँ {line}-{endLine}:",
 "अनुवाद के नियम","यहाँ जोड़े गए नियम हर अनुवाद के अपने चरण में लागू होते हैं। वे इसी ब्राउज़र में रखे जाते हैं।",
 "पढ़ने से पहले (स्रोत पाठ)","स्रोत को पढ़ने से पहले उसमें पाठ बदलें।",
 "प्राकृतिक भाषा के शब्दांकन","किसी साँचे के लिए प्राकृतिक भाषा द्वारा पढ़े जाने वाले और शब्दांकन।",
 "मेटा प्रोग्राम (नाम)","मेटा प्रोग्राम में चरों और फ़ंक्शनों के नाम बदलें।",
 "लिखने के बाद (लक्ष्य पाठ)","अनुवाद लिखे जाने के बाद उसमें पाठ बदलें।",
 "कोई भी भाषा","प्राकृतिक भाषा","भाषा…","साँचा","साँचा…","शब्दांकन","भाषा","खोजें","क्या खोजें",
 "नाम","बदलें","किससे बदलें","नया नाम","रेगुलर एक्सप्रेशन","नियम हटाएँ","JSON के रूप में नियम (आयात और निर्यात)","JSON लागू करें","नियम जोड़ें"],
}
lines = open(path).read().split('\n')
out = []
locale = None
def q(v): return '"' + v.replace('"', '\\"') + '"'
for line in lines:
    if line and not line.startswith(' ') and not line.startswith('#'):
        locale = line.strip()
    if locale in T and line == '  about':
        d = dict(zip(K, T[locale]))
        out.append('  untranslated')
        for k in ['summary','line','lines']: out.append(f'    {k} {q(d[k])}')
        out.append('  rules')
        out.append(f'    title {q(d["title"])}')
        out.append(f'    intro {q(d["intro"])}')
        for st in ['source','templates','names','output']:
            out.append(f'    {st}')
            out.append(f'      title {q(d[st+"Title"])}')
            out.append(f'      hint {q(d[st+"Hint"])}')
        for k in ['anyLanguage','naturalLanguage','chooseLanguage','template','chooseTemplate','wording','language','find','findText','name','replace','replaceText','newName','regex','remove','json','applyJson','add']:
            out.append(f'    {k} {q(d[k])}')
    out.append(line)
    if locale in T:
        d = dict(zip(K, T[locale]))
        if line.startswith('    swap '):
            out.append(f'    auto {q(d["auto"])}'); out.append(f'    autoDetected {q(d["autoDetected"])}')
        elif line.startswith('    commentsSame '):
            out.append(f'    allOrNothing {q(d["allOrNothing"])}')
        elif line.startswith('    targetMeta '):
            out.append(f'    undetected {q(d["undetected"])}')
open(path, 'w').write('\n'.join(out))
