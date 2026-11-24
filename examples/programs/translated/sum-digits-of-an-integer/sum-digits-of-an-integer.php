<?php

// Sum digits of an integer in PHP

function sumOfDigits($number) {
    $total = 0;
    while ($number > 0) {
        $total += $number % 10;
        $number = intdiv($number, 10);
    }
    return $total;
}

echo "The digits of 1234567890 sum to " . sumOfDigits(1234567890) . "\n";
