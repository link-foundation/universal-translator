// Fibonacci sequence in Go, computed iteratively

package main

import "fmt"

func fibonacci(count int) int {
	previous := 0
	current := 1
	for step := 0; step < count; step++ {
		next := previous + current
		previous = current
		current = next
	}
	return previous
}

func main() {
	for index := 0; index < 21; index++ {
		fmt.Printf("fibonacci(%d) = %d\n", index, fibonacci(index))
	}
}
