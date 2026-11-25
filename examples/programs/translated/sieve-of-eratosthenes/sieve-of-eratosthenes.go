// Sieve of Eratosthenes in Go: the primes up to 100

package main

import "fmt"

func main() {
	limit := 100
	isPrime := make([]int, limit + 1)
	for index := 0; index < limit + 1; index++ {
		isPrime[index] = 1
	}
	isPrime[0] = 0
	isPrime[1] = 0
	for number := 2; number < limit + 1; number++ {
		if isPrime[number] == 1 {
			fmt.Println(number)
			multiple := number * number
			for multiple <= limit {
				isPrime[multiple] = 0
				multiple += number
			}
		}
	}
}
