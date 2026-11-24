// Greatest common divisor in Go, using the Euclidean algorithm

package main

import "fmt"

func greatestCommonDivisor(first int, second int) int {
	for second != 0 {
		remainder := first % second
		first = second
		second = remainder
	}
	return first
}

func main() {
	fmt.Printf("The greatest common divisor of 1071 and 462 is %d\n", greatestCommonDivisor(1071, 462))
}
