// Factorial in Go, defined recursively

package main

import "fmt"

func factorial(number int) int {
	if number <= 1 {
		return 1
	}
	return number * factorial(number - 1)
}

func main() {
	for number := 0; number < 11; number++ {
		fmt.Printf("%d! = %d\n", number, factorial(number))
	}
}
