# Sieve of Eratosthenes in Nim: the primes up to 100

import std/sequtils

let limit = 100
var isPrime = newSeqWith(limit + 1, 1)
isPrime[0] = 0
isPrime[1] = 0
for number in 2 ..< limit + 1:
    if isPrime[number] == 1:
        echo number
        var multiple = number * number
        while multiple <= limit:
            isPrime[multiple] = 0
            multiple += number
