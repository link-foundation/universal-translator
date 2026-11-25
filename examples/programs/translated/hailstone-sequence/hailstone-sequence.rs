// Hailstone sequence in Rust: count the steps to reach 1

fn hailstone_steps(number: i64) -> i64 {
    let mut number: i64 = number;
    let mut steps: i64 = 0;
    while number != 1 {
        if number % 2 == 0 {
            number /= 2;
        } else {
            number = 3 * number + 1;
        }
        steps += 1;
    }
    return steps;
}

fn main() {
    for number in 1..11 {
        println!("{} takes {} steps", number, hailstone_steps(number));
    }
}
