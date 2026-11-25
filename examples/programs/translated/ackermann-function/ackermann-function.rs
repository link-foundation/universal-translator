// Ackermann function in Rust, defined recursively

fn ackermann(first: i64, second: i64) -> i64 {
    if first == 0 {
        return second + 1;
    }
    if second == 0 {
        return ackermann(first - 1, 1);
    }
    return ackermann(first - 1, ackermann(first, second - 1));
}

fn main() {
    for first in 0..4 {
        for second in 0..5 {
            println!("ackermann({}, {}) = {}", first, second, ackermann(first, second));
        }
    }
}
