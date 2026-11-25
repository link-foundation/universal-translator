#!/usr/bin/env bash
# Sieve of Eratosthenes in Bash: the primes up to 100

limit=100
is_prime=()
for (( index = 0; index < limit + 1; index++ )); do
    is_prime[index]=1
done
is_prime[0]=0
is_prime[1]=0
for (( number = 2; number < limit + 1; number++ )); do
    if (( is_prime[number] == 1 )); then
        echo "$number"
        multiple=$((number * number))
        while (( multiple <= limit )); do
            is_prime[multiple]=0
            multiple=$((multiple + number))
        done
    fi
done
