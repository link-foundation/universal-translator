<?php

// Fibonacci sequence in PHP, computed iteratively

function fibonacci($count) {
    $previous = 0;
    $current = 1;
    for ($step = 0; $step < $count; $step++) {
        $next = $previous + $current;
        $previous = $current;
        $current = $next;
    }
    return $previous;
}

for ($index = 0; $index < 21; $index++) {
    echo "fibonacci(" . $index . ") = " . fibonacci($index) . "\n";
}
