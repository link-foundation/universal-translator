// Leap year in Go

package main

import "fmt"

func isLeapYear(year int) bool {
	return (year % 4 == 0 && year % 100 != 0) || year % 400 == 0
}

func main() {
	for year := 1896; year < 1913; year++ {
		if isLeapYear(year) {
			fmt.Printf("%d is a leap year\n", year)
		} else {
			fmt.Printf("%d is not a leap year\n", year)
		}
	}
}
