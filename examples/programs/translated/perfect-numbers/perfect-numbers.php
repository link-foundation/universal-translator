<?php

// Perfect numbers in PHP: numbers equal to the sum of their divisors

function isPerfect($number) {
    $sum = 1;
    $divisor = 2;
    while ($divisor * $divisor <= $number) {
        if ($number % $divisor === 0) {
            $sum += $divisor;
            if ($divisor * $divisor !== $number) {
                $sum += intdiv($number, $divisor);
            }
        }
        $divisor += 1;
    }
    return $number > 1 && $sum === $number;
}

for ($number = 1; $number < 10001; $number++) {
    if (isPerfect($number)) {
        echo $number . "\n";
    }
}
