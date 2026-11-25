#!/usr/bin/env bash
# Hailstone sequence in Bash: count the steps to reach 1

hailstone_steps() {
    local number=$1
    local steps=0
    while (( number != 1 )); do
        if (( number % 2 == 0 )); then
            number=$((number / 2))
        else
            number=$((3 * number + 1))
        fi
        steps=$((steps + 1))
    done
    REPLY=$steps; return
}

for (( number = 1; number < 11; number++ )); do
    hailstone_steps "$number"
    echo "$number takes $REPLY steps"
done
