<?php

// Hailstone sequence in PHP: count the steps to reach 1

function hailstoneSteps($number) {
    $steps = 0;
    while ($number !== 1) {
        if ($number % 2 === 0) {
            $number = intdiv($number, 2);
        } else {
            $number = 3 * $number + 1;
        }
        $steps += 1;
    }
    return $steps;
}

for ($number = 1; $number < 11; $number++) {
    echo $number . " takes " . hailstoneSteps($number) . " steps\n";
}
