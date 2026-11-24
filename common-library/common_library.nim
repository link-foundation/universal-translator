# Standard-output operations of the common library for Nim.

proc printLine*(text: string) = echo text

proc writeText*(text: string) = stdout.write(text)

proc writeInteger*(integer: int) = stdout.write(integer)

proc endLine*() = echo ""
