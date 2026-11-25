# Add lexicon entries to every base natural language description, keeping
# the entries in alphabetical order. Usage: python3 experiments/add-natural-words.py
import pathlib, re

WORDS = {
    # language: (female, male, perfect)
    'chinese': ('女性', '男性', '完全'),
    'hindi': ('स्त्री', 'पुरुष', 'पूर्ण'),
    'spanish': ('femenino', 'masculino', 'perfecto'),
    'french': ('féminin', 'masculin', 'parfait'),
    'arabic': ('مؤنث', 'مذكر', 'تام'),
    'bengali': ('নারী', 'পুরুষ', 'নিখুঁত'),
    'portuguese': ('feminino', 'masculino', 'perfeito'),
    'russian': ('женская', 'мужская', 'совершенное'),
    'urdu': ('مونث', 'مذکر', 'کامل'),
    'indonesian': ('perempuan', 'lelaki', 'sempurna'),
    'german': ('weiblich', 'männlich', 'vollkommen'),
    'japanese': ('女性', '男性', '完全'),
    'marathi': ('स्त्री', 'पुरुष', 'परिपूर्ण'),
    'telugu': ('స్త్రీ', 'పురుష', 'పరిపూర్ణ'),
    'turkish': ('dişi', 'erkek', 'mükemmel'),
    'tamil': ('பெண்', 'ஆண்', 'முழு'),
    'vietnamese': ('nữ', 'nam', 'hoànhảo'),
    'korean': ('여성', '남성', '완전'),
    'italian': ('femminile', 'maschile', 'perfetto'),
    'persian': ('مؤنث', 'مذکر', 'کامل'),
    'swahili': ('kike', 'kiume', 'kamili'),
    'tagalog': ('babae', 'lalaki', 'perpekto'),
    'thai': ('หญิง', 'ชาย', 'สมบูรณ์'),
    'polish': ('żeński', 'męski', 'doskonała'),
    'ukrainian': ('жіноча', 'чоловіча', 'досконале'),
    'hausa': ('mace', 'namiji', 'cikakke'),
    'gujarati': ('સ્ત્રી', 'પુરુષ', 'સંપૂર્ણ'),
    'punjabi': ('ਇਸਤਰੀ', 'ਪੁਰਸ਼', 'ਸੰਪੂਰਨ'),
    'dutch': ('vrouwelijk', 'mannelijk', 'volmaakt'),
}

for language, (female, male, perfect) in WORDS.items():
    path = pathlib.Path(f'data/natural/{language}.lino')
    text = path.read_text()
    head, words = text.split('  words:\n')
    # Values keep their own quotes ("murabba'ai" needs double quotes).
    entries = dict(re.findall(r"    ([a-z]+): ('[^']*'|\"[^\"]*\")\n", words))
    for key, value in (('female', female), ('male', male), ('perfect', perfect)):
        entries.setdefault(key, f"'{value}'")
    body = ''.join(f"    {k}: {v}\n" for k, v in sorted(entries.items()))
    path.write_text(head + '  words:\n' + body)
