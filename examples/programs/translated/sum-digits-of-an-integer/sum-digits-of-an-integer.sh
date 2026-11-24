#!/usr/bin/env bash
# Sum digits of an integer in Bash

sum_of_digits() {
    local number=$1
    local total=0
    while (( number > 0 )); do
        total=$((total + number % 10))
        number=$((number / 10))
    done
    REPLY=$total; return
}

sum_of_digits 1234567890
echo "The digits of 1234567890 sum to $REPLY"
