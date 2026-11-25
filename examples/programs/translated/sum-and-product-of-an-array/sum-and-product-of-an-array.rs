// Sum and product of an array in Rust

fn main() {
    let numbers: Vec<i64> = vec![1, 2, 3, 4, 5];
    let mut total: i64 = 0;
    let mut product: i64 = 1;
    for index in 0..numbers.len() as i64 {
        total += numbers[index as usize];
        product *= numbers[index as usize];
    }
    println!("Sum: {}", total);
    println!("Product: {}", product);
}
