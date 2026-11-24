#!/usr/bin/env bash
# Greatest common divisor in Bash, using the Euclidean algorithm

greatest_common_divisor() {
    local first=$1 second=$2
    while (( second != 0 )); do
        local remainder=$((first % second))
        first=$second
        second=$remainder
    done
    REPLY=$first; return
}

greatest_common_divisor 1071 462
echo "The greatest common divisor of 1071 and 462 is $REPLY"
