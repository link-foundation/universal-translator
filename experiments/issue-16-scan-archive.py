"""Check the requested archive for credential-shaped data without printing it."""

import gzip
import json
from pathlib import Path
import re


patterns = {
    "github-token": re.compile(rb"gh[pousr]_[A-Za-z0-9]{36,255}"),
    "github-fine-token": re.compile(rb"github_pat_[A-Za-z0-9_]{40,255}"),
    "openai-key": re.compile(rb"(?<![A-Za-z0-9_-])sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,255}"),
    "aws-access-key": re.compile(rb"(?:AKIA|ASIA)[A-Z0-9]{16}"),
    "private-key": re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
}
root = Path("docs/case-studies/issue-16")
findings = []
files = 0
for path in sorted(root.rglob("*")):
    if not path.is_file() or path.suffix in {".png", ".jpg", ".jpeg", ".image"}:
        continue
    files += 1
    counts = {name: 0 for name in patterns}
    with (gzip.open(path, "rb") if path.suffix == ".gz" else path.open("rb")) as stream:
        pending = b""
        while chunk := stream.read(65536):
            pending += chunk
            if len(pending) < 1024:
                continue
            boundary = len(pending) - 512
            for name, pattern in patterns.items():
                counts[name] += sum(1 for m in pattern.finditer(pending) if m.start() < boundary)
            pending = pending[boundary:]
        for name, pattern in patterns.items():
            counts[name] += len(pattern.findall(pending))
    if any(counts.values()):
        findings.append({"file": str(path), "counts": {k: v for k, v in counts.items() if v}})
report = {"files": files, "findings": findings}
print(json.dumps(report, indent=2))
