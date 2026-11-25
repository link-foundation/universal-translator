function sumOfSquares(limit) {
    let total = 0;
    for (let i = 1; i < limit + 1; i++) {
        total += square(i);
    }
    return total;
}

function square(value) {
    return value * value;
}
