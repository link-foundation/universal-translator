// 99 bottles of beer in Go

package main

import "fmt"

func main() {
	bottles := 99
	for bottles > 0 {
		fmt.Printf("%d bottles of beer on the wall, %d bottles of beer.\n", bottles, bottles)
		fmt.Printf("Take one down and pass it around, %d bottles of beer on the wall.\n", bottles - 1)
		bottles -= 1
	}
}
