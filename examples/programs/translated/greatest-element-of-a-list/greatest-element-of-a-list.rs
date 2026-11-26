// Greatest element of a list in Rust

fn main() {
    let numbers: Vec<i64> = vec![17, 4, 93, 28, 65, 3, 80];
    let mut greatest: i64 = numbers[0];
    for &number in &numbers {
        if number > greatest {
            greatest = number;
        }
    }
    println!("The greatest element is {}", greatest);
}
