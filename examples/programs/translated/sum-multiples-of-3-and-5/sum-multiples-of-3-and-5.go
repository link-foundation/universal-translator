// Sum multiples of 3 and 5 in Go: the sum of the multiples below 1000

package main

import "fmt"

func main() {
	total := 0
	for number := 1; number < 1000; number++ {
		if number % 3 == 0 || number % 5 == 0 {
			total += number
		}
	}
	fmt.Println(total)
}
