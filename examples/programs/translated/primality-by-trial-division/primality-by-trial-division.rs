// Primality by trial division in Rust

fn is_prime(number: i64) -> bool {
    if number < 2 {
        return false;
    }
    let mut divisor: i64 = 2;
    while divisor * divisor <= number {
        if number % divisor == 0 {
            return false;
        }
        divisor += 1;
    }
    return true;
}

fn main() {
    for number in 1..51 {
        if is_prime(number) {
            println!("{}", number);
        }
    }
}
