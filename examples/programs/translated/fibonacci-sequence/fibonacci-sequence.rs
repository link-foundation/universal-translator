// Fibonacci sequence in Rust, computed iteratively

fn fibonacci(count: i64) -> i64 {
    let mut previous: i64 = 0;
    let mut current: i64 = 1;
    for step in 0..count {
        let next: i64 = previous + current;
        previous = current;
        current = next;
    }
    return previous;
}

fn main() {
    for index in 0..21 {
        println!("fibonacci({}) = {}", index, fibonacci(index));
    }
}
