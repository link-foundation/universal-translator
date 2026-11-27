fn report(value: i64) -> i64 {
    println!("call {value}");
    return value;
}

fn main() {
    let owner: &str = "Fox";
    println!("{{{1}}} is {} with {name}/{owner}", "first", "second", name = "third");
    println!("{item}/{0}/{item}", report(1), item = report(2));
    let itemName: &str = "wide";
    println!("{itemName:>6}");
    print!("{}/{}\n", report(3), report(4));
    println!("line\n");
    println!();
}
