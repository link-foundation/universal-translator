// Bubble sort in Rust: sort a list of numbers

fn main() {
    let mut numbers: Vec<i64> = vec![5, 3, 8, 1, 9, 2, 7];
    let count: i64 = numbers.len() as i64;
    for pass in 0..count - 1 {
        for index in 0..count - 1 - pass {
            if numbers[index as usize] > numbers[(index + 1) as usize] {
                let swap: i64 = numbers[index as usize];
                numbers[index as usize] = numbers[(index + 1) as usize];
                numbers[(index + 1) as usize] = swap;
            }
        }
    }
    for position in 0..count {
        println!("{}", numbers[position as usize]);
    }
}
