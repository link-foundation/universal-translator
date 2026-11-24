// Greatest common divisor in Rust, using the Euclidean algorithm

fn greatest_common_divisor(first: i64, second: i64) -> i64 {
    let mut first: i64 = first;
    let mut second: i64 = second;
    while second != 0 {
        let remainder: i64 = first % second;
        first = second;
        second = remainder;
    }
    return first;
}

fn main() {
    println!("The greatest common divisor of 1071 and 462 is {}", greatest_common_divisor(1071, 462));
}
