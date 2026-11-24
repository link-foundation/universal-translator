// Primality by trial division in Go

package main

import "fmt"

func isPrime(number int) bool {
	if number < 2 {
		return false
	}
	divisor := 2
	for divisor * divisor <= number {
		if number % divisor == 0 {
			return false
		}
		divisor += 1
	}
	return true
}

func main() {
	for number := 1; number < 51; number++ {
		if isPrime(number) {
			fmt.Println(number)
		}
	}
}
