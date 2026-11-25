// Towers of Hanoi in Go, solved recursively

package main

import "fmt"

func moveDisks(count int, source int, target int, spare int) {
	if count == 0 {
		return
	}
	moveDisks(count - 1, source, spare, target)
	fmt.Printf("Move disk %d from %d to %d\n", count, source, target)
	moveDisks(count - 1, spare, target, source)
}

func main() {
	moveDisks(4, 1, 3, 2)
}
