#!/usr/bin/env bash
# Perfect numbers in Bash: numbers equal to the sum of their divisors

is_perfect() {
    local number=$1
    local sum=1
    local divisor=2
    while (( divisor * divisor <= number )); do
        if (( number % divisor == 0 )); then
            sum=$((sum + divisor))
            if (( divisor * divisor != number )); then
                sum=$((sum + number / divisor))
            fi
        fi
        divisor=$((divisor + 1))
    done
    REPLY=$((number > 1 && sum == number)); return
}

for (( number = 1; number < 10001; number++ )); do
    is_perfect "$number"
    if (( REPLY )); then
        echo "$number"
    fi
done
