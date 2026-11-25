sum_of_squares() {
    local limit=$1
    local total=0
    local i
    for (( i = 1; i < limit + 1; i++ )); do
        square "$i"
        total=$((total + REPLY))
    done
    REPLY=$total; return
}

square() {
    local value=$1
    REPLY=$((value * value)); return
}
