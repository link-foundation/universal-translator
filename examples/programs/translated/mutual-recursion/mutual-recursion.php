<?php

// Mutual recursion in PHP: the Hofstadter Female and Male sequences

function female($index) {
    if ($index === 0) {
        return 1;
    }
    return $index - male(female($index - 1));
}

function male($index) {
    if ($index === 0) {
        return 0;
    }
    return $index - female(male($index - 1));
}

for ($index = 0; $index < 20; $index++) {
    echo $index . ": " . female($index) . " " . male($index) . "\n";
}
