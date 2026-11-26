// Leap year in GameMaker Language

function is_leap_year(year) {
    return (year % 4 == 0 && year % 100 != 0) || year % 400 == 0;
}

for (var year = 1896; year < 1913; year++) {
    if (is_leap_year(year)) {
        show_debug_message($"{year} is a leap year");
    } else {
        show_debug_message($"{year} is not a leap year");
    }
}
