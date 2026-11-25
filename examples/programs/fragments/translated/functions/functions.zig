fn sumOfSquares(limit: i64) i64 {
    var total: i64 = 0;
    var i: i64 = 1;
    while (i <= limit) : (i += 1) {
        total += square(i);
    }
    return total;
}

fn square(value: i64) i64 {
    return value * value;
}
