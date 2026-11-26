#!/usr/bin/env bash
# Loops/Foreach in Bash: print every element of a collection

numbers=(1 1 2 3 5 8 13 21)
for (( index = 0; index < ${#numbers[@]}; index++ )); do
    number=$((numbers[index]))
    echo "$number"
done
