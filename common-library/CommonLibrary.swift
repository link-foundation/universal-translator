// Standard-output operations of the common library for Swift.

func printLine(_ text: String) {
    print(text)
}

func writeText(_ text: String) {
    print(text, terminator: "")
}

func writeInteger(_ integer: Int) {
    print(integer, terminator: "")
}

func endLine() {
    print("")
}
