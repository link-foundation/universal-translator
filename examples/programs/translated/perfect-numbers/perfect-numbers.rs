// Perfect numbers in Rust: numbers equal to the sum of their divisors

fn is_perfect(number: i64) -> bool {
    let mut sum: i64 = 1;
    let mut divisor: i64 = 2;
    while divisor * divisor <= number {
        if number % divisor == 0 {
            sum += divisor;
            if divisor * divisor != number {
                sum += number / divisor;
            }
        }
        divisor += 1;
    }
    return number > 1 && sum == number;
}

fn main() {
    for number in 1..10001 {
        if is_perfect(number) {
            println!("{}", number);
        }
    }
}
