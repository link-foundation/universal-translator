#!/usr/bin/env bash
# Ackermann function in Bash, defined recursively

ackermann() {
    local first=$1 second=$2
    if (( first == 0 )); then
        REPLY=$((second + 1)); return
    fi
    if (( second == 0 )); then
        ackermann $((first - 1)) 1; return
    fi
    ackermann "$first" $((second - 1))
    ackermann $((first - 1)) "$REPLY"; return
}

for (( first = 0; first < 4; first++ )); do
    for (( second = 0; second < 5; second++ )); do
        ackermann "$first" "$second"
        echo "ackermann($first, $second) = $REPLY"
    done
done
