// Perfect numbers in Go: numbers equal to the sum of their divisors

package main

import "fmt"

func isPerfect(number int) bool {
	sum := 1
	divisor := 2
	for divisor * divisor <= number {
		if number % divisor == 0 {
			sum += divisor
			if divisor * divisor != number {
				sum += number / divisor
			}
		}
		divisor += 1
	}
	return number > 1 && sum == number
}

func main() {
	for number := 1; number < 10001; number++ {
		if isPerfect(number) {
			fmt.Println(number)
		}
	}
}
