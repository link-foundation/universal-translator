<?php

// Sieve of Eratosthenes in PHP: the primes up to 100

$limit = 100;
$isPrime = array_fill(0, $limit + 1, 1);
$isPrime[0] = 0;
$isPrime[1] = 0;
for ($number = 2; $number < $limit + 1; $number++) {
    if ($isPrime[$number] === 1) {
        echo $number . "\n";
        $multiple = $number * $number;
        while ($multiple <= $limit) {
            $isPrime[$multiple] = 0;
            $multiple += $number;
        }
    }
}
