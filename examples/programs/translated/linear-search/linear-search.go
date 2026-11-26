// Linear search in Go: find the position of a value in a list

package main

import "fmt"

func main() {
	numbers := []int{31, 41, 59, 26, 53, 58, 97, 93}
	wanted := 53
	position := -1
	current := 0
	for _, number := range numbers {
		if number == wanted && position < 0 {
			position = current
		}
		current += 1
	}
	fmt.Printf("Found %d at position %d\n", wanted, position)
}
