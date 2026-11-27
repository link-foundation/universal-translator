# Sum digits of an integer in Perl

use strict;
use warnings;

sub ut_integer_remainder {
    my ($first, $second) = @_;
    my $result = int($first / $second);
    return $first - $result * $second;
}

sub sum_of_digits {
    my ($number) = @_;
    my $total = 0;
    while ($number > 0) {
        $total += ut_integer_remainder($number, 10);
        $number = int($number / 10);
    }
    return $total;
}

print("The digits of 1234567890 sum to " . sum_of_digits(1234567890) . "\n");
