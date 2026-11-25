// Factorial in Rust, defined recursively

fn factorial(number: i64) -> i64 {
    if number <= 1 {
        return 1;
    }
    return number * factorial(number - 1);
}

fn main() {
    for number in 0..11 {
        println!("{}! = {}", number, factorial(number));
    }
}
