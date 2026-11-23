"""Stream a pinned Rosetta Code archive to the JavaScript and Rust verifiers."""

import argparse
from collections import Counter
from contextlib import suppress
from hashlib import file_digest
from pathlib import Path
from struct import pack
from subprocess import PIPE, Popen
from tarfile import open as open_tar


REVISION = "1d475861d7141ef2fafff293d9339f56e4b0f5db"
SHA256 = "6243ae216d0aa56951e2e26d6e44396a93ce8ac06076368c8f82d55cce1555df"
ROOT = Path(__file__).resolve().parents[2]


def source_records(archive):
    tasks = set()
    covered_tasks = set()
    languages = Counter()
    prefix = f"RosettaCodeData-{REVISION}/Task/"
    with open_tar(archive, "r|gz", bufsize=256 * 1024) as tar:
        for entry in tar:
            if not entry.name.startswith(prefix):
                continue
            path = entry.name.removeprefix(prefix)
            parts = path.split("/")
            if len(parts) == 2 and parts[1].startswith("00-") and entry.isfile():
                continue
            if entry.isdir():
                if len(parts) == 1:
                    tasks.add(parts[0])
                continue
            if not entry.isfile() or len(parts) != 3:
                raise ValueError(f"Unexpected task entry {path}")
            task, language, _ = parts
            covered_tasks.add(task)
            languages[language] += 1
            with tar.extractfile(entry) as file:
                yield path.encode("utf-8"), file.read()
    if len(tasks) != 1758 or tasks != covered_tasks:
        raise ValueError("Expected source files for each of the 1,758 tasks")
    if len(languages) != 883 or languages.total() != 143457:
        raise ValueError(f"Unexpected census of {languages.total()} source files")
    print(
        f"Verified archive selection across {len(tasks)} tasks and "
        f"{len(languages)} language directories, including "
        f"{languages['JavaScript']} JavaScript and {languages['Rust']} Rust files.",
        flush=True,
    )


def verify(archive, rust_binary):
    with archive.open("rb") as file:
        if file_digest(file, "sha256").hexdigest() != SHA256:
            raise ValueError("Rosetta Code archive SHA-256 does not match the pinned corpus")
    commands = [
        ["node", "examples/translation/verify-source-corpus.mjs", rust_binary],
        [
            "cargo", "test", "--locked", "--test", "source_document",
            "verify_source_corpus", "--", "--ignored", "--nocapture",
        ],
    ]
    workers = []
    try:
        for command in commands:
            workers.append(Popen(command, cwd=ROOT, stdin=PIPE))
        for path, source in source_records(archive):
            frame = pack("<II", len(path), len(source)) + path + source
            for worker in workers:
                worker.stdin.write(frame)
    finally:
        for worker in workers:
            with suppress(BrokenPipeError):
                worker.stdin.close()
        statuses = [worker.wait() for worker in workers]
    if any(statuses):
        raise RuntimeError(f"Corpus source verifiers exited with {statuses}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path, help=f"GitHub source tarball at {REVISION}")
    parser.add_argument("--rust-binary", default="target/debug/universal-translator")
    args = parser.parse_args()
    verify(args.archive, args.rust_binary)
