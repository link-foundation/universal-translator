// Sum and product of an array in Go

package main

import "fmt"

func main() {
	numbers := []int{1, 2, 3, 4, 5}
	total := 0
	product := 1
	for index := 0; index < len(numbers); index++ {
		total += numbers[index]
		product *= numbers[index]
	}
	fmt.Printf("Sum: %d\n", total)
	fmt.Printf("Product: %d\n", product)
}
