#!/usr/bin/env bash
# FizzBuzz in Bash

for (( number = 1; number < 101; number++ )); do
    if (( number % 15 == 0 )); then
        echo 'FizzBuzz'
    elif (( number % 3 == 0 )); then
        echo 'Fizz'
    elif (( number % 5 == 0 )); then
        echo 'Buzz'
    else
        echo "$number"
    fi
done
