<?php

// Linear search in PHP: find the position of a value in a list

$numbers = [31, 41, 59, 26, 53, 58, 97, 93];
$wanted = 53;
$position = -1;
$current = 0;
foreach ($numbers as $number) {
    if ($number === $wanted && $position < 0) {
        $position = $current;
    }
    $current += 1;
}
echo "Found " . $wanted . " at position " . $position . "\n";
