# FizzBuzz in Perl

use strict;
use warnings;

sub ut_integer_remainder {
    my ($first, $second) = @_;
    my $quotient = int($first / $second);
    return $first - $quotient * $second;
}

for my $number (1 .. 100) {
    if (ut_integer_remainder($number, 15) == 0) {
        print("FizzBuzz\n");
    } elsif (ut_integer_remainder($number, 3) == 0) {
        print("Fizz\n");
    } elsif (ut_integer_remainder($number, 5) == 0) {
        print("Buzz\n");
    } else {
        print($number . "\n");
    }
}
