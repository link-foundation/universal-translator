"""Fetch a bounded, pinned dependency closure for evaluating sibling reuse."""

from collections import deque
import hashlib
import json
from pathlib import Path, PurePosixPath
import posixpath
import re
from urllib.request import urlopen


revision = "a79782093cae3b33606483ac9f3e1d05faf36de0"
root = Path("docs/case-studies/issue-16/data/prior-art/meta-grammar-closure")
pending = deque([
    "js/src/grammar-importers.js",
    "js/src/grammar-emitters.js",
    "js/src/grammar-runtime.js",
    "js/src/grammar-merge.js",
    "js/src/grammar-rename.js",
    "js/src/grammar-interchange.js",
])
entries = {}
total = 0
while pending:
    name = pending.popleft()
    if name in entries:
        continue
    if len(entries) >= 256 or total > 8 * 1024 * 1024:
        raise RuntimeError("dependency closure exceeds the bounded evaluation")
    if name.startswith("../") or PurePosixPath(name).is_absolute():
        raise RuntimeError(f"path escapes source checkout: {name}")
    path = root / name
    if path.exists():
        data = path.read_bytes()
    else:
        url = f"https://raw.githubusercontent.com/link-foundation/meta-language/{revision}/{name}"
        with urlopen(url) as response:
            data = response.read(1024 * 1024 + 1)
        if len(data) > 1024 * 1024:
            raise RuntimeError(f"individual source exceeds evaluation bound: {name}")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    total += len(data)
    source = data.decode()
    # Anchoring static declarations avoids treating the grammar language's own
    # string literals (for example 'import') as JavaScript dependencies.
    imports = re.findall(
        r"^(?:import|export)\s+(?:[\w*{},\s]+?\s+from\s+)?['\"]([^'\"]+)['\"]",
        source, re.MULTILINE,
    )
    external = []
    for dependency in imports:
        if dependency.startswith("."):
            pending.append(posixpath.normpath(posixpath.join(posixpath.dirname(name), dependency)))
        else:
            external.append(dependency)
    entries[name] = {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(), "external": external}
    print(len(entries), name, len(data), flush=True)

(root / "manifest.json").write_text(json.dumps({
    "repository": "https://github.com/link-foundation/meta-language",
    "revision": revision,
    "bytes": total,
    "files": entries,
}, indent=2) + "\n")
