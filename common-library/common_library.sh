# Standard-output operations of the common library for Bash.

print_line() {
    printf '%s\n' "$1"
}

write_text() {
    printf '%s' "$1"
}

write_integer() {
    printf '%d' "$1"
}

end_line() {
    printf '\n'
}
