func sumOfSquares(limit int) int {
	total := 0
	for i := 1; i < limit + 1; i++ {
		total += square(i)
	}
	return total
}

func square(value int) int {
	return value * value
}
