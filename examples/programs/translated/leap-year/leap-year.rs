// Leap year in Rust

fn is_leap_year(year: i64) -> bool {
    return (year % 4 == 0 && year % 100 != 0) || year % 400 == 0;
}

fn main() {
    for year in 1896..1913 {
        if is_leap_year(year) {
            println!("{} is a leap year", year);
        } else {
            println!("{} is not a leap year", year);
        }
    }
}
