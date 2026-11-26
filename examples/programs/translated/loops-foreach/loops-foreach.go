// Loops/Foreach in Go: print every element of a collection

package main

import "fmt"

func main() {
	numbers := []int{1, 1, 2, 3, 5, 8, 13, 21}
	for _, number := range numbers {
		fmt.Println(number)
	}
}
