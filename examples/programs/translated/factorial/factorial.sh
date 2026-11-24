#!/usr/bin/env bash
# Factorial in Bash, defined recursively

factorial() {
    local number=$1
    if (( number <= 1 )); then
        REPLY=1; return
    fi
    factorial $((number - 1))
    REPLY=$((number * REPLY)); return
}

for (( number = 0; number < 11; number++ )); do
    factorial "$number"
    echo "$number! = $REPLY"
done
