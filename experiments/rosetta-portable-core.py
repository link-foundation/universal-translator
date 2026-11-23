"""Stream the pinned JavaScript and Rust sources to the portable-core probe."""

import sys
from contextlib import redirect_stdout
from pathlib import Path
from runpy import run_path
from struct import pack


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: rosetta-portable-core.py <pinned Rosetta Code archive>")
    driver = Path(__file__).resolve().parents[1] / "examples/translation/verify-corpus.py"
    source_records = run_path(str(driver))["source_records"]
    output = sys.stdout.buffer
    with redirect_stdout(sys.stderr):
        for path, source in source_records(Path(sys.argv[1])):
            if path.split(b"/")[1] in (b"JavaScript", b"Rust"):
                output.write(pack("<II", len(path), len(source)) + path + source)
