#!/usr/bin/env bash
# 99 bottles of beer in Bash

bottles=99
while (( bottles > 0 )); do
    echo "$bottles bottles of beer on the wall, $bottles bottles of beer."
    echo "Take one down and pass it around, $((bottles - 1)) bottles of beer on the wall."
    bottles=$((bottles - 1))
done
