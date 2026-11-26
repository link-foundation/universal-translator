"""Archive primary documentation for the grammar and NLP architecture audit."""
import json
from pathlib import Path
from urllib.request import Request, urlopen

sources = {
 'antlr-import': 'https://raw.githubusercontent.com/antlr/antlr4/master/doc/grammars.md',
 'antlr-token-stream': 'https://raw.githubusercontent.com/antlr/antlr4/master/runtime/Java/src/org/antlr/v4/runtime/TokenStreamRewriter.java',
 'tree-sitter-grammar': 'https://tree-sitter.github.io/tree-sitter/creating-parsers/2-the-grammar-dsl.html',
 'tree-sitter-incremental': 'https://tree-sitter.github.io/tree-sitter/using-parsers/3-advanced-parsing.html',
 'spacy': 'https://spacy.io/usage/linguistic-features',
 'stanza': 'https://stanfordnlp.github.io/stanza/',
 'nltk': 'https://www.nltk.org/book/ch08.html',
 'lark': 'https://raw.githubusercontent.com/lark-parser/lark/master/docs/grammar.md',
 'gf': 'https://www.grammaticalframework.org/lib/doc/synopsis/',
 'link-grammar': 'https://raw.githubusercontent.com/opencog/link-grammar/master/README.md',
}
root = Path('docs/case-studies/issue-16/data/prior-art')
root.mkdir(exist_ok=True)
manifest = []
for name, url in sources.items():
 try:
  with urlopen(Request(url, headers={'User-Agent':'universal-translator-issue-16-research'})) as response:
   body = response.read(2_000_001)
   if len(body) > 2_000_000:
    raise ValueError('documentation exceeds bounded archive size')
  path = root / (name + ('.html' if b'<html' in body[:1000].lower() else '.txt'))
  path.write_bytes(body)
  manifest.append({'name': name, 'url': url, 'file': str(path), 'bytes': len(body)})
 except Exception as error:
  manifest.append({'name': name, 'url': url, 'error': str(error)})
(root/'manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
print(json.dumps(manifest, indent=2))
