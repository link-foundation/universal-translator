// Sum multiples of 3 and 5 in Rust: the sum of the multiples below 1000

fn main() {
    let mut total: i64 = 0;
    for number in 1..1000 {
        if number % 3 == 0 || number % 5 == 0 {
            total += number;
        }
    }
    println!("{}", total);
}
