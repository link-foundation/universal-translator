"""Stream a pinned Rosetta Code archive to the JavaScript and Rust verifiers."""

import argparse
from collections import Counter
from contextlib import ExitStack, suppress
from hashlib import file_digest
from html.parser import HTMLParser
from itertools import chain
from os import environ
from pathlib import Path
from platform import machine, system
from struct import pack
from subprocess import PIPE, Popen, check_output
from tarfile import open as open_tar
from tempfile import TemporaryDirectory


REVISION = "1d475861d7141ef2fafff293d9339f56e4b0f5db"
SHA256 = "6243ae216d0aa56951e2e26d6e44396a93ce8ac06076368c8f82d55cce1555df"
HELLO_WORLD_SHA256 = "17055bc3f041d24bc3ae3b11145cdddaaf14ce14c84cb778359e8a995345575d"
ROOT = Path(__file__).resolve().parents[2]


class HelloWorldListings(HTMLParser):
    def __init__(self):
        super().__init__()
        self.language = "C (introductory example)"
        self.listings = []
        self.lines = None

    def handle_starttag(self, tag, attrs):
        if tag == "a" and (anchor := dict(attrs).get("name")):
            self.language = anchor
        if tag == "pre":
            self.lines = []

    def handle_endtag(self, tag):
        if tag == "pre":
            self.listings.append((self.language, "".join(self.lines)))
            self.lines = None

    def handle_data(self, data):
        if self.lines is not None:
            self.lines.append(data)


def hello_world_records(path):
    if path is None:
        return
    with path.open("rb") as file:
        if file_digest(file, "sha256").hexdigest() != HELLO_WORLD_SHA256:
            raise ValueError("Hello World Collection SHA-256 does not match the pinned page")
    page = HelloWorldListings()
    page.feed(path.read_bytes().decode("utf-8"))
    page.close()
    if len(page.listings) != 591:
        raise ValueError("Expected 591 textual Hello World Collection listings")
    for index, (language, source) in enumerate(page.listings, 1):
        yield f"Hello World Collection/{language}/{index}".encode(), source.encode()
    print("Verified selection of 591 Hello World Collection text listings.", flush=True)


def source_records(archive):
    if archive is None:
        return
    with archive.open("rb") as file:
        if file_digest(file, "sha256").hexdigest() != SHA256:
            raise ValueError("Rosetta Code archive SHA-256 does not match the pinned corpus")
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


def verify(archive, rust_binary, hello_world=None, require_full_native=False):
    env = environ.copy()
    with ExitStack() as toolchains:
        if archive is not None and (system(), machine()) == ("Linux", "x86_64"):
            for variable, script in (
                ("ROSETTA_LEGACY_RUSTC", "prepare-legacy-rust.sh"),
                ("ROSETTA_QUICKJS", "prepare-quickjs.sh"),
            ):
                if not env.get(variable):
                    workspace = toolchains.enter_context(
                        TemporaryDirectory(prefix=f"translator-{script.removesuffix('.sh')}-")
                    )
                    env[variable] = check_output(
                        ["bash", f"examples/translation/{script}", workspace],
                        cwd=ROOT, text=True,
                    ).strip()
        return verify_stream(archive, rust_binary, hello_world, require_full_native, env)


def verify_stream(archive, rust_binary, hello_world, require_full_native, env):
    javascript = ["node", "examples/translation/verify-source-corpus.mjs", rust_binary]
    if archive is None:
        javascript.append("--hello-world-only")
    if require_full_native:
        javascript.append("--require-full-native")
    commands = [
        javascript,
        [
            "cargo", "test", "--locked", "--test", "source_document",
            "verify_source_corpus", "--", "--ignored", "--nocapture",
        ],
    ]
    workers = []
    try:
        for command in commands:
            workers.append(Popen(command, cwd=ROOT, stdin=PIPE, env=env))
        for path, source in chain(hello_world_records(hello_world), source_records(archive)):
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
    parser.add_argument("archive", type=Path, nargs="?", help=f"GitHub source tarball at {REVISION}")
    parser.add_argument("--rust-binary", default="target/debug/universal-translator")
    parser.add_argument("--hello-world", type=Path, help="Pinned Hello World Collection HTML")
    parser.add_argument("--require-full-native", action="store_true", help="Require native translation of all JavaScript and Rust examples")
    args = parser.parse_args()
    if args.archive is None and args.hello_world is None:
        parser.error("provide an archive or --hello-world")
    if args.require_full_native and args.archive is None:
        parser.error("--require-full-native needs the Rosetta Code archive")
    verify(args.archive, args.rust_binary, args.hello_world, args.require_full_native)
