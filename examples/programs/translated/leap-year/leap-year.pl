# Leap year in Perl

use strict;
use warnings;

sub ut_integer_remainder {
    my ($first, $second) = @_;
    my $result = int($first / $second);
    return $first - $result * $second;
}

sub is_leap_year {
    my ($year) = @_;
    return (ut_integer_remainder($year, 4) == 0 && ut_integer_remainder($year, 100) != 0) || ut_integer_remainder($year, 400) == 0;
}

for my $year (1896 .. 1912) {
    if (is_leap_year($year)) {
        print($year . " is a leap year\n");
    } else {
        print($year . " is not a leap year\n");
    }
}
