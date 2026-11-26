#!/usr/bin/env bash
# Sum multiples of 3 and 5 in Bash: the sum of the multiples below 1000

total=0
for (( number = 1; number < 1000; number++ )); do
    if (( number % 3 == 0 || number % 5 == 0 )); then
        total=$((total + number))
    fi
done
echo "$total"
