<?php

// Ackermann function in PHP, defined recursively

function ackermann($first, $second) {
    if ($first === 0) {
        return $second + 1;
    }
    if ($second === 0) {
        return ackermann($first - 1, 1);
    }
    return ackermann($first - 1, ackermann($first, $second - 1));
}

for ($first = 0; $first < 4; $first++) {
    for ($second = 0; $second < 5; $second++) {
        echo "ackermann(" . $first . ", " . $second . ") = " . ackermann($first, $second) . "\n";
    }
}
