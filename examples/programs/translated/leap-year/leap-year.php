<?php

// Leap year in PHP

function isLeapYear($year) {
    return ($year % 4 === 0 && $year % 100 !== 0) || $year % 400 === 0;
}

for ($year = 1896; $year < 1913; $year++) {
    if (isLeapYear($year)) {
        echo $year . " is a leap year\n";
    } else {
        echo $year . " is not a leap year\n";
    }
}
