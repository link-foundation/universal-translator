#!/usr/bin/env bash
# Greatest element of a list in Bash

numbers=(17 4 93 28 65 3 80)
greatest=$((numbers[0]))
for (( index = 0; index < ${#numbers[@]}; index++ )); do
    number=$((numbers[index]))
    if (( number > greatest )); then
        greatest=$number
    fi
done
echo "The greatest element is $greatest"
