// Hailstone sequence in Go: count the steps to reach 1

package main

import "fmt"

func hailstoneSteps(number int) int {
	steps := 0
	for number != 1 {
		if number % 2 == 0 {
			number /= 2
		} else {
			number = 3 * number + 1
		}
		steps += 1
	}
	return steps
}

func main() {
	for number := 1; number < 11; number++ {
		fmt.Printf("%d takes %d steps\n", number, hailstoneSteps(number))
	}
}
