// 99 bottles of beer in Rust

fn main() {
    let mut bottles: i64 = 99;
    while bottles > 0 {
        println!("{} bottles of beer on the wall, {} bottles of beer.", bottles, bottles);
        println!("Take one down and pass it around, {} bottles of beer on the wall.", bottles - 1);
        bottles -= 1;
    }
}
