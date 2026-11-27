# Leap year in Perl

use strict;
use warnings;

sub is_leap_year {
    my ($year) = @_;
    return ($year % 4 == 0 && $year % 100 != 0) || $year % 400 == 0;
}

for my $year (1896 .. 1912) {
    if (is_leap_year($year)) {
        print($year . " is a leap year\n");
    } else {
        print($year . " is not a leap year\n");
    }
}
