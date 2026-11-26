<?php

// Greatest element of a list in PHP

$numbers = [17, 4, 93, 28, 65, 3, 80];
$greatest = $numbers[0];
foreach ($numbers as $number) {
    if ($number > $greatest) {
        $greatest = $number;
    }
}
echo "The greatest element is " . $greatest . "\n";
