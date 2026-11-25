#!/usr/bin/env bash
# Sum of squares in Bash

sum_of_squares() {
    local limit=$1
    local total=0
    local number=1
    while (( number <= limit )); do
        total=$((total + number * number))
        number=$((number + 1))
    done
    REPLY=$total; return
}

limit=10
echo "Sum of squares from 1 to $limit:"
sum_of_squares "$limit"
echo "$REPLY"
