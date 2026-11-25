function sumOfSquares(limit: number): number {
    let total = 0;
    for (let i = 1; i < limit + 1; i++) {
        total += square(i);
    }
    return total;
}

function square(value: number): number {
    return value * value;
}
