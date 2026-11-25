fn sum_of_squares(limit: i64) -> i64 {
    let mut total: i64 = 0;
    for i in 1..limit + 1 {
        total += square(i);
    }
    return total;
}

fn square(value: i64) -> i64 {
    return value * value;
}
