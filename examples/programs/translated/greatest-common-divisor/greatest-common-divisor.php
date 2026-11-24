<?php

// Greatest common divisor in PHP, using the Euclidean algorithm

function greatestCommonDivisor($first, $second) {
    while ($second !== 0) {
        $remainder = $first % $second;
        $first = $second;
        $second = $remainder;
    }
    return $first;
}

echo "The greatest common divisor of 1071 and 462 is " . greatestCommonDivisor(1071, 462) . "\n";
