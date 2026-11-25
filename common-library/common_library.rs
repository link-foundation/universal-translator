//! Standard-output operations of the common library for Rust.

pub fn print_line(text: &str) {
    print!("{text}\n");
}

pub fn write_text(text: &str) {
    print!("{text}");
}

pub fn write_integer(integer: i64) {
    print!("{integer}");
}

pub fn end_line() {
    print!("\n");
}
