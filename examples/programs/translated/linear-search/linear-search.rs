// Linear search in Rust: find the position of a value in a list

fn main() {
    let numbers: Vec<i64> = vec![31, 41, 59, 26, 53, 58, 97, 93];
    let wanted: i64 = 53;
    let mut position: i64 = -1;
    let mut current: i64 = 0;
    for &number in &numbers {
        if number == wanted && position < 0 {
            position = current;
        }
        current += 1;
    }
    println!("Found {} at position {}", wanted, position);
}
