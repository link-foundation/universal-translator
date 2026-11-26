// Greatest element of a list in Go

package main

import "fmt"

func main() {
	numbers := []int{17, 4, 93, 28, 65, 3, 80}
	greatest := numbers[0]
	for _, number := range numbers {
		if number > greatest {
			greatest = number
		}
	}
	fmt.Printf("The greatest element is %d\n", greatest)
}
