// Mutual recursion in Rust: the Hofstadter Female and Male sequences

fn female(index: i64) -> i64 {
    if index == 0 {
        return 1;
    }
    return index - male(female(index - 1));
}

fn male(index: i64) -> i64 {
    if index == 0 {
        return 0;
    }
    return index - female(male(index - 1));
}

fn main() {
    for index in 0..20 {
        println!("{}: {} {}", index, female(index), male(index));
    }
}
