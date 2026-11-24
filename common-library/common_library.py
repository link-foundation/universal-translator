"""Standard-output operations of the common library for Python."""

import sys


def print_line(text):
    sys.stdout.write(text + "\n")


def write_text(text):
    sys.stdout.write(text)


def write_integer(integer):
    sys.stdout.write(str(integer))


def end_line():
    sys.stdout.write("\n")
