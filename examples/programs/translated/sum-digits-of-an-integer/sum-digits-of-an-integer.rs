// Sum digits of an integer in Rust

fn sum_of_digits(number: i64) -> i64 {
    let mut number: i64 = number;
    let mut total: i64 = 0;
    while number > 0 {
        total += number % 10;
        number /= 10;
    }
    return total;
}

fn main() {
    println!("The digits of 1234567890 sum to {}", sum_of_digits(1234567890));
}
