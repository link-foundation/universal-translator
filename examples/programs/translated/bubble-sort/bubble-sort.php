<?php

// Bubble sort in PHP: sort a list of numbers

$numbers = [5, 3, 8, 1, 9, 2, 7];
$count = count($numbers);
for ($pass = 0; $pass < $count - 1; $pass++) {
    for ($index = 0; $index < $count - 1 - $pass; $index++) {
        if ($numbers[$index] > $numbers[$index + 1]) {
            $swap = $numbers[$index];
            $numbers[$index] = $numbers[$index + 1];
            $numbers[$index + 1] = $swap;
        }
    }
}
for ($position = 0; $position < $count; $position++) {
    echo $numbers[$position] . "\n";
}
