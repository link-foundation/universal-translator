//! Standard-output operations shared by the JavaScript and Rust forms.

pub fn print_line(message: &str) {
    println!("{message}");
}

pub fn write_text(message: &str) {
    print!("{message}");
}
