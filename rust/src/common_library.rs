//! Operations shared by the JavaScript and Rust common forms.

pub fn print_line(message: &str) {
    println!("{message}");
}

pub fn greatest_common_divisor(mut left: u32, mut right: u32) -> u32 {
    while right != 0 {
        (left, right) = (right, left % right);
    }
    left
}

pub fn fizz_buzz_lines(limit: u32) -> impl Iterator<Item = String> {
    (1..=limit).map(|number| match (number % 3, number % 5) {
        (0, 0) => "FizzBuzz".into(),
        (0, _) => "Fizz".into(),
        (_, 0) => "Buzz".into(),
        _ => number.to_string(),
    })
}
