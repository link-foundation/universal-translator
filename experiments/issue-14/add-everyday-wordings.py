"""Adds everyday wordings to the natural language descriptions (issue 6, item 10).

Each language gets increase and decrease (read as the assignment that adds or
subtracts); the main European languages also get everyday forms of print,
set and let. Running it twice changes nothing.
"""
import re
import sys

EVERYDAY = {
    'arabic': {'increase': ['زد {name} بمقدار {value}'], 'decrease': ['أنقص {name} بمقدار {value}']},
    'bengali': {'increase': ['{name} কে {value} বাড়াও'], 'decrease': ['{name} কে {value} কমাও']},
    'chinese': {'increase': ['把 {name} 增加 {value}', '将 {name} 增加 {value}'], 'decrease': ['把 {name} 减少 {value}', '将 {name} 减少 {value}']},
    'dutch': {'increase': ['Verhoog {name} met {value}', 'Tel {value} op bij {name}'], 'decrease': ['Verlaag {name} met {value}', 'Trek {value} af van {name}'],
              'print-line': ['Druk {value} af', 'Toon {value}'], 'assign': ['Zet {name} op {value}'], 'declare': ['Laat {name} gelijk zijn aan {value}']},
    'french': {'increase': ['Augmenter {name} de {value}', 'Ajouter {value} à {name}'], 'decrease': ['Diminuer {name} de {value}', 'Soustraire {value} de {name}'],
               'print-line': ['Afficher {value}', 'Imprimer {value}'], 'assign': ['Mettre {name} à {value}'], 'declare': ['Soit {name} égal à {value}']},
    'german': {'increase': ['Erhöhe {name} um {value}', 'Addiere {value} zu {name}'], 'decrease': ['Verringere {name} um {value}', 'Subtrahiere {value} von {name}'],
               'print-line': ['Gib {value} aus', 'Zeige {value}'], 'assign': ['Setze {name} auf {value}'], 'declare': ['Sei {name} gleich {value}']},
    'gujarati': {'increase': ['{name} ને {value} વધારો'], 'decrease': ['{name} ને {value} ઘટાડો']},
    'hausa': {'increase': ['Ƙara {name} da {value}'], 'decrease': ['Rage {name} da {value}']},
    'hindi': {'increase': ['{name} को {value} से बढ़ाएँ'], 'decrease': ['{name} को {value} से घटाएँ']},
    'indonesian': {'increase': ['Naikkan {name} sebesar {value}', 'Tambahkan {value} ke {name}'], 'decrease': ['Turunkan {name} sebesar {value}', 'Kurangkan {value} dari {name}']},
    'italian': {'increase': ['Aumenta {name} di {value}', 'Aggiungi {value} a {name}'], 'decrease': ['Diminuisci {name} di {value}', 'Sottrai {value} da {name}'],
                'print-line': ['Stampa {value}', 'Mostra {value}'], 'assign': ['Imposta {name} a {value}'], 'declare': ['Sia {name} uguale a {value}']},
    'japanese': {'increase': ['{name} を {value} 増やす'], 'decrease': ['{name} を {value} 減らす']},
    'korean': {'increase': ['{name} 을 {value} 만큼 늘린다'], 'decrease': ['{name} 을 {value} 만큼 줄인다']},
    'marathi': {'increase': ['{name} ला {value} ने वाढवा'], 'decrease': ['{name} ला {value} ने कमी करा']},
    'persian': {'increase': ['{name} را به اندازه {value} افزایش بده'], 'decrease': ['{name} را به اندازه {value} کاهش بده']},
    'polish': {'increase': ['Zwiększ {name} o {value}', 'Dodaj {value} do {name}'], 'decrease': ['Zmniejsz {name} o {value}', 'Odejmij {value} od {name}'],
               'print-line': ['Wyświetl {value}', 'Pokaż {value}', 'Wydrukuj {value}'], 'assign': ['Ustaw {name} na {value}'], 'declare': ['Niech {name} będzie równe {value}']},
    'portuguese': {'increase': ['Aumentar {name} em {value}', 'Somar {value} a {name}'], 'decrease': ['Diminuir {name} em {value}', 'Subtrair {value} de {name}'],
                   'print-line': ['Mostrar {value}', 'Imprimir {value}', 'Exibir {value}'], 'assign': ['Definir {name} como {value}'], 'declare': ['Seja {name} igual a {value}']},
    'punjabi': {'increase': ['{name} ਨੂੰ {value} ਵਧਾਓ'], 'decrease': ['{name} ਨੂੰ {value} ਘਟਾਓ']},
    'spanish': {'increase': ['Aumentar {name} en {value}', 'Sumar {value} a {name}'], 'decrease': ['Disminuir {name} en {value}', 'Restar {value} a {name}'],
                'print-line': ['Mostrar {value}', 'Imprimir {value}'], 'assign': ['Poner {name} en {value}'], 'declare': ['Sea {name} igual a {value}']},
    'swahili': {'increase': ['Ongeza {name} kwa {value}'], 'decrease': ['Punguza {name} kwa {value}']},
    'tagalog': {'increase': ['Dagdagan ang {name} ng {value}'], 'decrease': ['Bawasan ang {name} ng {value}']},
    'tamil': {'increase': ['{name} ஐ {value} ஆல் அதிகரி'], 'decrease': ['{name} ஐ {value} ஆல் குறை']},
    'telugu': {'increase': ['{name} ను {value} పెంచు'], 'decrease': ['{name} ను {value} తగ్గించు']},
    'thai': {'increase': ['เพิ่ม {name} อีก {value}'], 'decrease': ['ลด {name} ลง {value}']},
    'turkish': {'increase': ['{name} değerini {value} artır'], 'decrease': ['{name} değerini {value} azalt']},
    'ukrainian': {'increase': ['Збільшити {name} на {value}', 'Додати {value} до {name}'], 'decrease': ['Зменшити {name} на {value}', 'Відняти {value} від {name}'],
                  'print-line': ['Надрукувати {value}', 'Вивести {value}', 'Показати {value}'], 'assign': ['Встановити {name} в {value}', 'Присвоїти {name} значення {value}'],
                  'declare': ['Нехай {name} дорівнює {value}', 'Нехай {name} буде {value}']},
    'urdu': {'increase': ['{name} کو {value} سے بڑھائیں'], 'decrease': ['{name} کو {value} سے گھٹائیں']},
    'vietnamese': {'increase': ['Tăng {name} thêm {value}'], 'decrease': ['Giảm {name} đi {value}']},
}

quote = lambda text: "'" + text.replace("'", "\\'") + "'"

for language, keys in EVERYDAY.items():
    path = f'{sys.argv[1] if len(sys.argv) > 1 else "data/natural"}/{language}.lino'
    lines = open(path, encoding='utf-8').read().split('\n')
    for key, wordings in keys.items():
        index = next((i for i, line in enumerate(lines) if line.startswith(f'    {key}:')), None)
        if index is None:
            after = next(i for i, line in enumerate(lines) if line.startswith('    assign:'))
            after += sum(1 for line in lines[after + 1:after + 3] if re.match(r'    (increase|decrease):', line))
            lines.insert(after + 1, f'    {key}: ' + ' '.join(quote(w) for w in wordings))
            continue
        for wording in wordings:
            if quote(wording) not in lines[index]:
                lines[index] += ' ' + quote(wording)
    open(path, 'w', encoding='utf-8').write('\n'.join(lines))
