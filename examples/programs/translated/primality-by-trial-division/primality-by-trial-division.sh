#!/usr/bin/env bash
# Primality by trial division in Bash

is_prime() {
    local number=$1
    if (( number < 2 )); then
        REPLY=0; return
    fi
    local divisor=2
    while (( divisor * divisor <= number )); do
        if (( number % divisor == 0 )); then
            REPLY=0; return
        fi
        divisor=$((divisor + 1))
    done
    REPLY=1; return
}

for (( number = 1; number < 51; number++ )); do
    is_prime "$number"
    if (( REPLY )); then
        echo "$number"
    fi
done
