<?php

// Primality by trial division in PHP

function isPrime($number) {
    if ($number < 2) {
        return false;
    }
    $divisor = 2;
    while ($divisor * $divisor <= $number) {
        if ($number % $divisor === 0) {
            return false;
        }
        $divisor += 1;
    }
    return true;
}

for ($number = 1; $number < 51; $number++) {
    if (isPrime($number)) {
        echo $number . "\n";
    }
}
