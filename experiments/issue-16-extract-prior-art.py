"""Extract archived primary documentation without fetching it again."""

from html.parser import HTMLParser
import json
from pathlib import Path


class DocumentationText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.hidden = 0
        self.lines = []

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style"}:
            self.hidden += 1
        if tag in {"p", "div", "li", "tr", "h1", "h2", "h3", "h4", "pre", "br"}:
            self.lines.append("\n")

    def handle_endtag(self, tag):
        if tag in {"script", "style"}:
            self.hidden = max(0, self.hidden - 1)
        if tag in {"p", "div", "li", "tr", "h1", "h2", "h3", "h4", "pre"}:
            self.lines.append("\n")

    def handle_data(self, text):
        if not self.hidden:
            self.lines.append(text)


root = Path("docs/case-studies/issue-16/data/prior-art")
for item in json.loads((root / "manifest.json").read_text()):
    if "file" not in item:
        continue
    path = Path(item["file"])
    body = path.read_text()
    if "<html" not in body.lower():
        continue
    parser = DocumentationText()
    parser.feed(body)
    lines = [line.strip() for line in "".join(parser.lines).splitlines()]
    destination = root / (item["name"] + ".readable.txt")
    destination.write_text("\n".join(line for line in lines if line) + "\n")
    print(destination, len(lines))
