"""Preserve primary arithmetic manuals used by the finite native review."""
import gzip
import hashlib
import json
from pathlib import Path
from urllib.request import Request, urlopen

folder = Path('docs/case-studies/issue-16/data/prior-art/arithmetic')
manifest = json.loads((folder / 'manifest.json').read_text())
for name, url in [
    ('python-expressions.html.gz', 'https://docs.python.org/3/reference/expressions.html'),
    ('perl-operators.html.gz', 'https://perldoc.perl.org/perlop'),
    ('lua54-manual.html.gz', 'https://www.lua.org/manual/5.4/manual.html'),
    ('r-arithmetic.html.gz', 'https://stat.ethz.ch/R-manual/R-devel/library/base/html/Arithmetic.html'),
    ('ruby-integer.html.gz', 'https://docs.ruby-lang.org/en/master/Integer.html'),
]:
    body = urlopen(Request(url, headers={'User-Agent': 'universal-translator-reference-audit'})).read()
    (folder / name).write_bytes(gzip.compress(body, mtime=0))
    manifest = [item for item in manifest if item['file'] != name]
    manifest.append({'file': name, 'url': url, 'bytes': len(body), 'sha256': hashlib.sha256(body).hexdigest()})
(folder / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
