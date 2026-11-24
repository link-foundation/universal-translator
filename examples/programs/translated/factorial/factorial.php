<?php

// Factorial in PHP, defined recursively

function factorial($number) {
    if ($number <= 1) {
        return 1;
    }
    return $number * factorial($number - 1);
}

for ($number = 0; $number < 11; $number++) {
    echo $number . "! = " . factorial($number) . "\n";
}
