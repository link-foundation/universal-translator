// Standard-output operations of the common library for Go.
package main

import "fmt"

func printLine(text string) {
	fmt.Print(text, "\n")
}

func writeText(text string) {
	fmt.Print(text)
}

func writeInteger(integer int) {
	fmt.Print(integer)
}

func endLine() {
	fmt.Print("\n")
}
