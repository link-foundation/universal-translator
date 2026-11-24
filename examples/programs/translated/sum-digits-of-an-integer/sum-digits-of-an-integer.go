// Sum digits of an integer in Go

package main

import "fmt"

func sumOfDigits(number int) int {
	total := 0
	for number > 0 {
		total += number % 10
		number /= 10
	}
	return total
}

func main() {
	fmt.Printf("The digits of 1234567890 sum to %d\n", sumOfDigits(1234567890))
}
