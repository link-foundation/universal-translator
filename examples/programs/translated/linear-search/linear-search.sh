#!/usr/bin/env bash
# Linear search in Bash: find the position of a value in a list

numbers=(31 41 59 26 53 58 97 93)
wanted=53
position=-1
current=0
for (( index = 0; index < ${#numbers[@]}; index++ )); do
    number=$((numbers[index]))
    if (( number == wanted && position < 0 )); then
        position=$current
    fi
    current=$((current + 1))
done
echo "Found $wanted at position $position"
