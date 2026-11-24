// Sum of squares in Rust

fn sum_of_squares(limit: i64) -> i64 {
    let mut total: i64 = 0;
    let mut number: i64 = 1;
    while number <= limit {
        total += number * number;
        number += 1;
    }
    return total;
}

fn main() {
    let limit: i64 = 10;
    println!("Sum of squares from 1 to {}:", limit);
    println!("{}", sum_of_squares(limit));
}
