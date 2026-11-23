//! Operations shared by the JavaScript and Rust common forms.

pub fn print_line(message: &str) {
    println!("{message}");
}

pub fn write_text(message: &str) {
    print!("{message}");
}

pub fn greatest_common_divisor(mut left: u32, mut right: u32) -> u32 {
    while right != 0 {
        (left, right) = (right, left % right);
    }
    left
}

/// Returns the Ackermann function on 0..=3 × 0..=4.
pub fn ackermann(first: u64, second: u64) -> u64 {
    assert!(second <= 4, "Expected the second Ackermann input in 0..=4");
    match first {
        0 => second + 1,
        1 => second + 2,
        2 => 2 * second + 3,
        3 => (1 << (second + 3)) - 3,
        _ => panic!("Expected the first Ackermann input in 0..=3"),
    }
}

pub fn fizz_buzz_lines(limit: u32) -> impl Iterator<Item = String> {
    (1..=limit).map(|number| match (number % 3, number % 5) {
        (0, 0) => "FizzBuzz".into(),
        (0, _) => "Fizz".into(),
        (_, 0) => "Buzz".into(),
        _ => number.to_string(),
    })
}
