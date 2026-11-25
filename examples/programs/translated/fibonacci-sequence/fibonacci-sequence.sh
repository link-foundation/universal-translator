#!/usr/bin/env bash
# Fibonacci sequence in Bash, computed iteratively

fibonacci() {
    local count=$1
    local previous=0
    local current=1
    local step
    for (( step = 0; step < count; step++ )); do
        local next=$((previous + current))
        previous=$current
        current=$next
    done
    REPLY=$previous; return
}

for (( index = 0; index < 21; index++ )); do
    fibonacci "$index"
    echo "fibonacci($index) = $REPLY"
done
