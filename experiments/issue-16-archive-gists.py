"""Archive referenced solver logs through authenticated GitHub CLI, streaming gzip."""

import gzip
import hashlib
import json
import pathlib
import re
import subprocess


root = pathlib.Path("docs/case-studies/issue-16/data")
destination = root / "solver-logs"
destination.mkdir(exist_ok=True)
references = {}
for discussion in sorted(root.glob("discussion-*.md")):
    for gist in re.findall(
        r"https://gist\.(?:github|githubusercontent)\.com/[^/\s)]+/([a-f0-9]{20,40})",
        discussion.read_text(),
    ):
        references.setdefault(gist, set()).add(discussion.name)

manifest = []
previous = {}
for name in ["first-attempt-manifest.json", "manifest.json"]:
    if (destination / name).exists():
        previous.update({
            row["gist"]: row
            for row in json.loads((destination / name).read_text())
        })
for gist, discussions in sorted(references.items()):
    output = destination / f"{gist}.txt.gz"
    if previous.get(gist, {}).get("exitStatus") == 0 and output.exists():
        manifest.append(previous[gist])
        continue
    errors = destination / f"{gist}.stderr.txt"
    digest = hashlib.sha256()
    size = 0
    with errors.open("wb") as stderr:
        process = subprocess.Popen(
            ["gh", "gist", "view", gist, "--raw", "--allow-escape-sequences"],
            stdout=subprocess.PIPE,
            stderr=stderr,
        )
        with gzip.open(output, "wb", compresslevel=1) as archive:
            while chunk := process.stdout.read(65536):
                archive.write(chunk)
                digest.update(chunk)
                size += len(chunk)
        process.stdout.close()
        status = process.wait()
    if not errors.stat().st_size:
        errors.unlink()
    manifest.append(
        {
            "gist": gist,
            "discussions": sorted(discussions),
            "file": output.name,
            "bytes": size,
            "sha256": digest.hexdigest(),
            "exitStatus": status,
        }
    )
    (destination / "manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n"
    )
    print(f"{gist}: {size} bytes, exit {status}", flush=True)

(destination / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
