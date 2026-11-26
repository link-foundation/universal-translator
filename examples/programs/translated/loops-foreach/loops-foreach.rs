// Loops/Foreach in Rust: print every element of a collection

fn main() {
    let numbers: Vec<i64> = vec![1, 1, 2, 3, 5, 8, 13, 21];
    for &number in &numbers {
        println!("{}", number);
    }
}
