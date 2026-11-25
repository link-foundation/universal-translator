<?php

// Sum of squares in PHP

function sumOfSquares($limit) {
    $total = 0;
    $number = 1;
    while ($number <= $limit) {
        $total += $number * $number;
        $number += 1;
    }
    return $total;
}

$limit = 10;
echo "Sum of squares from 1 to " . $limit . ":\n";
echo sumOfSquares($limit) . "\n";
