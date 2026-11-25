// Mutual recursion in Go: the Hofstadter Female and Male sequences

package main

import "fmt"

func female(index int) int {
	if index == 0 {
		return 1
	}
	return index - male(female(index - 1))
}

func male(index int) int {
	if index == 0 {
		return 0
	}
	return index - female(male(index - 1))
}

func main() {
	for index := 0; index < 20; index++ {
		fmt.Printf("%d: %d %d\n", index, female(index), male(index))
	}
}
