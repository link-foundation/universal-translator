// Towers of Hanoi in Rust, solved recursively

fn move_disks(count: i64, source: i64, target: i64, spare: i64) {
    if count == 0 {
        return;
    }
    move_disks(count - 1, source, spare, target);
    println!("Move disk {} from {} to {}", count, source, target);
    move_disks(count - 1, spare, target, source);
}

fn main() {
    move_disks(4, 1, 3, 2);
}
