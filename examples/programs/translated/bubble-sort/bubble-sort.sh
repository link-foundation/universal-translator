#!/usr/bin/env bash
# Bubble sort in Bash: sort a list of numbers

numbers=(5 3 8 1 9 2 7)
count=${#numbers[@]}
for (( pass = 0; pass < count - 1; pass++ )); do
    for (( index = 0; index < count - 1 - pass; index++ )); do
        if (( numbers[index] > numbers[index + 1] )); then
            swap=$((numbers[index]))
            numbers[index]=$((numbers[index + 1]))
            numbers[index+1]=$swap
        fi
    done
done
for (( position = 0; position < count; position++ )); do
    echo $((numbers[position]))
done
