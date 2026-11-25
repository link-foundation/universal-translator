// Ackermann function in Go, defined recursively

package main

import "fmt"

func ackermann(first int, second int) int {
	if first == 0 {
		return second + 1
	}
	if second == 0 {
		return ackermann(first - 1, 1)
	}
	return ackermann(first - 1, ackermann(first, second - 1))
}

func main() {
	for first := 0; first < 4; first++ {
		for second := 0; second < 5; second++ {
			fmt.Printf("ackermann(%d, %d) = %d\n", first, second, ackermann(first, second))
		}
	}
}
