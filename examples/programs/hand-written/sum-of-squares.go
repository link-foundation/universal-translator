// Sum of squares in Go

package main

import "fmt"

func sumOfSquares(limit int) int {
	total := 0
	number := 1
	for number <= limit {
		total += number * number
		number++
	}
	return total
}

func main() {
	limit := 10
	fmt.Printf("Sum of squares from 1 to %d:\n", limit)
	fmt.Println(sumOfSquares(limit))
}
