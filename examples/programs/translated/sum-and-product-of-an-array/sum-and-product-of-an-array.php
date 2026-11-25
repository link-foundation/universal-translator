<?php

// Sum and product of an array in PHP

$numbers = [1, 2, 3, 4, 5];
$total = 0;
$product = 1;
for ($index = 0; $index < count($numbers); $index++) {
    $total += $numbers[$index];
    $product *= $numbers[$index];
}
echo "Sum: " . $total . "\n";
echo "Product: " . $product . "\n";
